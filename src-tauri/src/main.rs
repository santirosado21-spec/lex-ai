#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{io::{BufRead, BufReader}, process::{Child, Command, Stdio}, sync::Mutex};
use tauri::Manager;
mod dof_capture;
#[derive(Clone, serde::Serialize, serde::Deserialize)]
struct Connection { url: String, token: String }
// Own the backend from the instant spawn succeeds, including setup errors.
struct ManagedChild(Child);
impl ManagedChild {
 fn stop(&mut self) {
  self.0.stdin.take();
  for _ in 0..40 {if self.0.try_wait().ok().flatten().is_some(){return;}std::thread::sleep(std::time::Duration::from_millis(100));}
  let _=self.0.kill();let _=self.0.wait();
 }
}
impl Drop for ManagedChild {fn drop(&mut self){self.stop();}}
struct Runtime { child: Mutex<ManagedChild>, connection: Connection }
#[tauri::command]
fn connection(window: tauri::WebviewWindow, state: tauri::State<Runtime>) -> Result<Connection,String> {
 let u=window.url().map_err(|_|"No se pudo verificar la vista")?;
 if window.label()!="main" || !connection_origin(&u) {return Err("Vista no permitida".into());}
 Ok(state.connection.clone())
}
// Only the existing packaged UI or explicit debug Vite origin receives a session.
fn connection_origin(u:&tauri::Url)->bool {
 dof_capture::packaged_main(u) || (cfg!(debug_assertions) && u.scheme()=="http"
 && matches!(u.host_str(),Some("localhost")|Some("127.0.0.1")) && u.port()==Some(1420)
 && u.username().is_empty() && u.password().is_none())
}
#[cfg(feature="native-pilot-preview")]
mod native_pilot;
#[cfg(feature="native-pilot-preview")]
fn main(){native_pilot::run();}
#[cfg(not(feature="native-pilot-preview"))]
fn main() {
 let app = tauri::Builder::default().setup(|app| {
  let base = app.path().resource_dir()?.join("app");
  let data = app.path().app_data_dir()?;
  std::fs::create_dir_all(&data)?;
  let mut child = ManagedChild(Command::new(base.join("runtime/node"))
   .arg(base.join("server/main.mjs"))
   .current_dir(&base).env_clear()
   .env("HOME",std::env::var("HOME").unwrap_or_default())
   .env("PATH","/usr/bin:/bin")
   .env("LEX_DATA_DIR",data)
   .env("LEX_DESKTOP","1")
   .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn()?);
  let stdout=child.0.stdout.take().ok_or("No se pudo conectar con el servicio local")?;
  let (tx,rx)=std::sync::mpsc::channel();
  std::thread::spawn(move || { let mut line=String::new(); let result=BufReader::new(stdout).read_line(&mut line).map(|_|line);let _=tx.send(result); });
  let result=rx.recv_timeout(std::time::Duration::from_secs(30));
  let conn=match result {
   Ok(Ok(line))=>serde_json::from_str::<Connection>(&line),
   _=>{child.stop();return Err("El servicio local no respondió al iniciar".into());}
  };
  match conn {Ok(connection)=>{app.manage(Runtime{child:Mutex::new(child),connection});},Err(e)=>{child.stop();return Err(e.into());}}
  app.manage(dof_capture::CaptureGate(Mutex::new(())));
  Ok(())
 }).invoke_handler(tauri::generate_handler![connection,dof_capture::open_review_capture]).build(tauri::generate_context!()).expect("No se pudo abrir Rejon.AI");
 app.run(|handle,event|{if let tauri::RunEvent::Exit=event {
  if let Some(state)=handle.try_state::<Runtime>() {if let Ok(mut child)=state.child.lock(){
   child.stop();
  }}
 }});
}
