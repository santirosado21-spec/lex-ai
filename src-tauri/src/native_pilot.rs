//! Feature-off preparation. Rust compilation and runtime evidence are separate gates.
use std::{process::{Command,Stdio},sync::{Arc,Mutex},time::Duration};
use tauri::{Manager,WebviewWindow,ipc::{Request,InvokeBody}};
use serde_json::Value;
#[path="native_pilot_bridge.rs"]mod bridge;
use bridge::{Bridge,ChildOwner};
const ID:&str="mx.lexai.nativepilot.preview";
const HASH:&str="pilot=intake&native=preview";
const ERROR:&str="No se pudo completar la operación nativa.";
struct Owner(Arc<ChildOwner>);
struct State(Arc<Mutex<Bridge>>);
fn allowed(label:&str,u:&tauri::Url)->bool {label=="main"&&crate::dof_capture::packaged_main(u)&&u.fragment()==Some(HASH)}
fn authorize(window:&WebviewWindow,request:&Request<'_>)->Result<(),String>{
 let url=window.url().map_err(|_|ERROR)?;
 if !allowed(window.label(),&url)||!matches!(request.body(),InvokeBody::Json(v) if v.as_object().map(|o|o.is_empty()).unwrap_or(false)){return Err(ERROR.into());}Ok(())
}
async fn operation(window:WebviewWindow,request:Request<'_>,state:tauri::State<'_,State>,op:&str)->Result<Value,String>{authorize(&window,&request)?;{let shared=state.0.clone();let op=op.to_owned();tauri::async_runtime::spawn_blocking(move||shared.try_lock().map_err(|_|ERROR.to_string())?.request(&op)).await.map_err(|_|ERROR.to_string())?}}
#[tauri::command]async fn native_status(window:WebviewWindow,request:Request<'_>,state:tauri::State<'_,State>)->Result<Value,String>{operation(window,request,state,"status").await}
#[tauri::command]async fn native_create(window:WebviewWindow,request:Request<'_>,state:tauri::State<'_,State>)->Result<Value,String>{operation(window,request,state,"create").await}
#[tauri::command]async fn native_unlock(window:WebviewWindow,request:Request<'_>,state:tauri::State<'_,State>)->Result<Value,String>{operation(window,request,state,"unlock").await}
#[tauri::command]async fn native_lock(window:WebviewWindow,request:Request<'_>,state:tauri::State<'_,State>)->Result<Value,String>{operation(window,request,state,"lock").await}
#[tauri::command]fn native_connection(window:WebviewWindow,request:Request<'_>,state:tauri::State<'_,State>)->Result<Value,String>{authorize(&window,&request)?;{let bridge=state.0.try_lock().map_err(|_|ERROR)?;if bridge.owner.terminal(){return Err(ERROR.into());}bridge.connection.clone().ok_or(ERROR.into())}}
pub fn run(){
 let app=tauri::Builder::default().setup(|app|{
  if app.config().identifier!=ID{return Err(ERROR.into());}
  let root=app.path().app_data_dir()?;std::fs::create_dir_all(&root)?;let root=root.canonicalize()?;
  let base=app.path().resource_dir()?.join("app");
  let mut child=Command::new(base.join("runtime/node")).arg(base.join("server/native-pilot-entry.mjs")).arg(root).arg("preview").current_dir(&base).env_clear().stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn()?;
  let input=child.stdin.take();let stdout=child.stdout.take();
  let input=input.ok_or(ERROR)?;let stdout=stdout.ok_or(ERROR)?;
  let owner=ChildOwner::new(child,input);
  let mut bridge=Bridge::new(owner.clone(),stdout,Duration::from_secs(250));
  app.manage(Owner(owner));
  bridge.request("status")?;
  app.manage(State(Arc::new(Mutex::new(bridge))));
  app.get_webview_window("main").ok_or(ERROR)?.navigate(tauri::Url::parse("tauri://localhost/index.html#pilot=intake&native=preview")?)?;
  Ok(())
 }).on_window_event(|window,event|{
  if window.label()=="main"&&matches!(event,tauri::WindowEvent::CloseRequested{..}|tauri::WindowEvent::Destroyed){if let Some(owner)=window.try_state::<Owner>(){let result=owner.0.stop();eprintln!("native-pilot-close:{:?}",result);}}
 }).invoke_handler(tauri::generate_handler![native_status,native_create,native_unlock,native_lock,native_connection]).build(tauri::generate_context!()).expect("No se pudo preparar el piloto nativo");
 app.run(|handle,event|{if let tauri::RunEvent::Exit=event {if let Some(owner)=handle.try_state::<Owner>(){let result=owner.0.stop();eprintln!("native-pilot-close:{:?}",result);}}});
}
#[cfg(test)]mod tests{use super::*;#[test]fn callers(){assert!(allowed("main",&tauri::Url::parse("tauri://localhost/index.html#pilot=intake&native=preview").unwrap()));for raw in ["tauri://localhost/index.html#pilot=intake","http://localhost:1420/#pilot=intake&native=preview","tauri://localhost/other#pilot=intake&native=preview"]{assert!(!allowed("main",&tauri::Url::parse(raw).unwrap()));}assert!(!allowed("foreign",&tauri::Url::parse("tauri://localhost/#pilot=intake&native=preview").unwrap()));}}
