//! Local candidate. No generic opener, caller-provided URL or plugin.
use std::sync::Mutex;
use tauri::{ipc::{InvokeBody,Request},webview::NewWindowResponse,AppHandle,Manager,State,Url,WebviewUrl,WebviewWindow,WebviewWindowBuilder};
use crate::Runtime;
pub const VIEWER_LABEL:&str="dof-source-capture";
pub struct CaptureGate(pub Mutex<()>);
pub fn packaged_main(u:&Url)->bool {
 u.scheme()=="tauri" && u.host_str()==Some("localhost") && u.port().is_none()
 && u.username().is_empty() && u.password().is_none() && u.query().is_none()
 && matches!(u.path(),""|"/"|"/index.html")
}
pub fn capture_caller(label:&str,u:&Url)->bool {
 label=="main" && packaged_main(u) && u.fragment()==Some("review=dof")
}
pub fn capture_destination(raw:&str)->Result<Url,String>{
 let u=Url::parse(raw).map_err(|_|"Servicio local no válido")?;
 if u.scheme()!="http" || u.host_str()!=Some("127.0.0.1") || !u.port().map(|p|p>=1024).unwrap_or(false)
 || !u.username().is_empty() || u.password().is_some() || u.path()!="/" || u.query().is_some() || u.fragment().is_some(){return Err("Servicio local no válido".into());}
 u.join("/dev/dof-review/source").map_err(|_|"Captura local no válida".into())
}
#[tauri::command]
pub async fn open_review_capture(app:AppHandle,window:WebviewWindow,request:Request<'_>,runtime:State<'_,Runtime>,gate:State<'_,CaptureGate>)->Result<(),String>{
 let u=window.url().map_err(|_|"No se pudo verificar la vista")?;
 if !capture_caller(window.label(),&u){return Err("Esta vista no puede abrir la captura".into());}
 if !matches!(request.body(),InvokeBody::Json(v) if v.as_object().map(|o|o.is_empty()).unwrap_or(false)){return Err("No se permiten argumentos".into());}
 let destination=capture_destination(&runtime.connection.url)?;
 let _lock=gate.0.lock().map_err(|_|"No se pudo abrir la captura")?;
 if let Some(viewer)=app.get_webview_window(VIEWER_LABEL){return viewer.set_focus().map_err(|_|"No se pudo enfocar la captura".into());}
 let exact=destination.clone();
 WebviewWindowBuilder::new(&app,VIEWER_LABEL,WebviewUrl::External(destination))
 .title("Captura original DOF").inner_size(1000.0,800.0).incognito(true).disable_javascript()
 .on_navigation(move|u|u==&exact).on_new_window(|_,_|NewWindowResponse::Deny).build()
 .map(|_|()).map_err(|_|"No se pudo abrir la captura original".into())
}
#[cfg(test)]mod tests{
 use super::*;
 #[test]fn caller_is_packaged_review_only(){
  for raw in ["tauri://localhost#review=dof","tauri://localhost/#review=dof","tauri://localhost/index.html#review=dof"]{let u=Url::parse(raw).unwrap();assert!(capture_caller("main",&u));assert!(!capture_caller(VIEWER_LABEL,&u));}
  for raw in ["tauri://localhost","tauri://localhost/probe.html#review=dof","tauri://localhost:1420#review=dof","tauri://u@localhost#review=dof","tauri://localhost?q=x#review=dof","tauri://localhost#review=dof&token=x","http://localhost:1420/#review=dof"]{assert!(!capture_caller("main",&Url::parse(raw).unwrap()));}
 }
 #[test]fn destination_has_no_page_input_or_token(){
  assert_eq!(capture_destination("http://127.0.0.1:51000").unwrap().as_str(),"http://127.0.0.1:51000/dev/dof-review/source");
  for raw in ["http://localhost:51000","http://127.0.0.1","http://127.0.0.1:80","http://u:p@127.0.0.1:51000","http://127.0.0.1:51000/api","http://127.0.0.1:51000?token=x","http://127.0.0.1:51000#x","https://127.0.0.1:51000"]{assert!(capture_destination(raw).is_err());}
 }
}
