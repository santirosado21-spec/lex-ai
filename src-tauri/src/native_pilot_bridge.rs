//! Specific private Node child lifecycle, independent of Tauri for real Rust tests.
use std::{io::{Read,BufReader,Write},process::{Child,ChildStdin,ChildStdout},sync::{Arc,Mutex,Condvar,atomic::{AtomicBool,Ordering},mpsc},time::{Duration,Instant}};
use serde_json::{json,Value};
const ERROR:&str="No se pudo completar la operación nativa.";
#[derive(Clone,Copy,Debug,PartialEq,Eq)]pub enum StopOutcome{Graceful,Forced,Unconfirmed}
pub struct ChildOwner {child:Mutex<Child>,input:Mutex<Option<ChildStdin>>,terminal:AtomicBool,closing:AtomicBool,outcome:Mutex<Option<StopOutcome>>,finished:Condvar}
impl ChildOwner {
 pub fn new(child:Child,input:ChildStdin)->Arc<Self>{Arc::new(Self{child:Mutex::new(child),input:Mutex::new(Some(input)),terminal:AtomicBool::new(false),closing:AtomicBool::new(false),outcome:Mutex::new(None),finished:Condvar::new()})}
 #[cfg(test)]pub fn outcome(&self)->Option<StopOutcome>{*self.outcome.lock().unwrap_or_else(|e|e.into_inner())}
 pub fn terminal(&self)->bool{self.terminal.load(Ordering::SeqCst)}
 pub fn stop(&self)->StopOutcome{self.stop_with_grace(Duration::from_secs(5))}
 fn stop_with_grace(&self,grace:Duration)->StopOutcome{
  self.terminal.store(true,Ordering::SeqCst);
  if self.closing.swap(true,Ordering::SeqCst){
   let guard=self.outcome.lock().unwrap_or_else(|e|e.into_inner());
   let (guard,_)=self.finished.wait_timeout_while(guard,Duration::from_secs(8),|value|value.is_none()).unwrap_or_else(|e|e.into_inner());
   return guard.unwrap_or(StopOutcome::Unconfirmed);
  }
  self.input.lock().unwrap_or_else(|e|e.into_inner()).take();
  let wait=|duration:Duration|{let end=Instant::now()+duration;loop{
   {let mut child=self.child.lock().unwrap_or_else(|e|e.into_inner());match child.try_wait(){Ok(Some(status))=>return Some(status),Err(_)=>return None,_=>{}}}
   if Instant::now()>=end{return None;}std::thread::sleep(Duration::from_millis(10));
  }};
  let result=if let Some(status)=wait(grace){if status.success(){StopOutcome::Graceful}else{StopOutcome::Unconfirmed}}
   else {let sent={let mut child=self.child.lock().unwrap_or_else(|e|e.into_inner());child.kill().is_ok()};if sent&&wait(Duration::from_secs(2)).is_some(){StopOutcome::Forced}else{StopOutcome::Unconfirmed}};
  *self.outcome.lock().unwrap_or_else(|e|e.into_inner())=Some(result);self.finished.notify_all();result
 }
 #[cfg(test)]fn gone(&self)->bool{self.child.lock().unwrap().try_wait().unwrap().is_some()}
}
impl Drop for ChildOwner {fn drop(&mut self){self.stop();}}
pub struct Bridge {pub owner:Arc<ChildOwner>,responses:mpsc::Receiver<Result<Value,()>>,pub connection:Option<Value>,timeout:Duration}
impl Bridge {
 pub fn new(owner:Arc<ChildOwner>,stdout:ChildStdout,timeout:Duration)->Self{
  let(tx,rx)=mpsc::sync_channel(1);
  std::thread::spawn(move||{let mut reader=BufReader::new(stdout);loop{let mut frame=Vec::new();let parsed=(||{loop{let mut byte=[0u8;1];reader.read_exact(&mut byte).map_err(|_|())?;frame.push(byte[0]);if frame.len()>4096{return Err(());}if byte[0]==10{break;}}serde_json::from_slice::<Value>(&frame).map_err(|_|())})();let bad=parsed.is_err();if tx.send(parsed).is_err()||bad{break;}}});
  Self{owner,responses:rx,connection:None,timeout}
 }
 pub fn stop(&mut self)->StopOutcome{self.connection=None;let result=self.owner.stop();eprintln!("native-pilot-close:{:?}",result);result}
 pub fn request(&mut self,op:&str)->Result<Value,String>{
  if self.owner.terminal(){return Err(ERROR.into());}
  if !matches!(op,"status"|"create"|"unlock"|"lock"|"dispose"){return Err(ERROR.into());}
  if op=="lock"||op=="dispose"{self.connection=None;}
  let result:Result<Value,()>=(||{
   let bytes=format!("{{\"op\":\"{}\"}}\n",op);{let mut pipe=self.owner.input.lock().map_err(|_|())?;let input=pipe.as_mut().ok_or(())?;input.write_all(bytes.as_bytes()).map_err(|_|())?;input.flush().map_err(|_|())?;}
   let response=self.responses.recv_timeout(self.timeout).map_err(|_|())??;
   if self.owner.terminal(){return Err(());}
   if response.get("ok").and_then(Value::as_bool)!=Some(true){if op=="lock"||op=="dispose"{return Err(());}return Ok(json!({"requestRejected":true}));}
   let data=response.get("result").ok_or(())?.clone();
   if op=="create"||op=="unlock"{
    let connection=data.get("connection").ok_or(())?.clone();let raw=connection.get("url").and_then(Value::as_str).ok_or(())?;
    // Strict concrete loopback endpoint, no URL parser dependency in this module.
    let port=raw.strip_prefix("http://127.0.0.1:").ok_or(())?;if !port.bytes().all(|b|b.is_ascii_digit())||port.parse::<u16>().map_err(|_|())?<1024{return Err(());}
    let token=connection.get("token").and_then(Value::as_str).ok_or(())?;if token.len()!=64||!token.bytes().all(|b|b.is_ascii_hexdigit()){return Err(());}self.connection=Some(connection);
   }
   Ok(json!({"state":data.get("state").and_then(Value::as_str).ok_or(())?}))
  })();
  match result {Ok(v)=>if v.get("requestRejected").is_some(){Err(ERROR.into())}else{Ok(v)},Err(())=>{self.stop();Err(ERROR.into())}}
 }
}
impl Drop for Bridge {fn drop(&mut self){self.stop();}}
#[cfg(test)]mod tests{
 use super::*;use std::process::{Command,Stdio};
 fn child(script:&str,timeout:Duration)->Bridge{let mut c=Command::new("/bin/sh").args(["-c",script]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().unwrap();let input=c.stdin.take().unwrap();let stdout=c.stdout.take().unwrap();Bridge::new(ChildOwner::new(c,input),stdout,timeout)}
 #[test]fn reject_close_is_terminal_and_reaped(){let mut b=child("while read line; do printf '%s\\n' '{\"ok\":false}'; done",Duration::from_secs(1));assert!(b.request("lock").is_err());assert!(b.owner.terminal());assert!(b.owner.gone());assert!(b.request("status").is_err());}
 #[test]fn eof_and_timeout_are_terminal(){for script in ["exit 0","read line; read more"]{let mut b=child(script,Duration::from_millis(30));assert!(b.request("status").is_err());assert!(b.owner.gone());assert!(b.owner.terminal());}}
 #[test]fn stop_does_not_wait_for_request_mutex_or_dialog(){let mut b=child("read line; read more",Duration::from_secs(5));let owner=b.owner.clone();let worker=std::thread::spawn(move||b.request("unlock"));std::thread::sleep(Duration::from_millis(30));let start=Instant::now();let second=owner.clone();let concurrent=std::thread::spawn(move||second.stop());owner.stop();concurrent.join().unwrap();assert!(start.elapsed()<Duration::from_secs(2));assert!(owner.gone());assert!(worker.join().unwrap().is_err());}
 #[test]fn normal_status_then_eof_reaps(){let mut b=child("while read line; do printf '%s\\n' '{\"ok\":true,\"result\":{\"state\":\"locked\"}}'; done",Duration::from_secs(1));assert_eq!(b.request("status").unwrap()["state"],"locked");b.stop();assert!(b.owner.gone());}
 #[test]fn delayed_graceful_and_forced_are_distinct(){
  let mut delayed=child("while read line; do :; done; sleep 0.4",Duration::from_secs(1));assert_eq!(delayed.stop(),StopOutcome::Graceful);assert!(delayed.owner.gone());
  let forced=child("while :; do :; done",Duration::from_secs(1));assert_eq!(forced.owner.stop_with_grace(Duration::from_millis(20)),StopOutcome::Forced);assert!(forced.owner.gone());assert_eq!(forced.owner.outcome(),Some(StopOutcome::Forced));
 }
 #[test]fn actual_node_entry_closes_vault_and_reopens_integrity(){
  let repo=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap();
  let root=std::env::temp_dir().join(format!("rejon-rust-vault-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));std::fs::create_dir(&root).unwrap();let root=root.canonicalize().unwrap();
  struct Cleanup(std::path::PathBuf);impl Drop for Cleanup{fn drop(&mut self){let _=std::fs::remove_dir_all(&self.0);}}let _cleanup=Cleanup(root.clone());
  let spawn_entry=||{let mut c=Command::new("node").arg(repo.join("tests/fixtures/native-pilot-rust/entry.mjs")).arg(&root).current_dir(repo).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().unwrap();let input=c.stdin.take().unwrap();let stdout=c.stdout.take().unwrap();Bridge::new(ChildOwner::new(c,input),stdout,Duration::from_secs(5))};
  for(mode,op)in[("save","create"),("read","unlock")]{let mut b=spawn_entry();assert_eq!(b.request(op).unwrap()["state"],"unlocked");let conn=b.connection.clone().unwrap();let mut check=Command::new("node").arg(repo.join("tests/fixtures/native-pilot-rust/vault-check.mjs")).stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().unwrap();let payload=json!({"url":conn["url"],"token":conn["token"],"mode":mode,"root":root});check.stdin.take().unwrap().write_all(payload.to_string().as_bytes()).unwrap();assert!(check.wait().unwrap().success());assert_eq!(b.stop(),StopOutcome::Graceful);assert!(b.owner.gone());assert_eq!(b.owner.outcome(),Some(StopOutcome::Graceful));}
  std::fs::remove_dir_all(root).unwrap();
 }

}
