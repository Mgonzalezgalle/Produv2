import { Component, useEffect } from "react";
import { Card, Empty } from "../../lib/ui/components";

export function Toast({ msg, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, []);
  const c = { ok: "var(--cy)", err: "var(--red)", warn: "var(--yel)" }[type] || "var(--cy)";
  return <div className="toast-box" style={{position:"fixed",bottom:20,right:20,zIndex:9999,background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 18px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 8px 32px #0007",animation:"slideIn .2s ease",maxWidth:340,fontSize:13,color:"var(--wh)"}}><div style={{width:8,height:8,borderRadius:"50%",background:c,boxShadow:`0 0 8px ${c}`,flexShrink:0}}/>{msg}</div>;
}

export class TaskErrorBoundary extends Component {
  constructor(props){
    super(props);
    this.state={hasError:false};
  }
  static getDerivedStateFromError(){
    return {hasError:true};
  }
  componentDidCatch(){}
  render(){
    if(this.state.hasError){
      return <Card title={this.props.title||"Tareas"}>
        <Empty text="No pudimos cargar este bloque de tareas" sub="Recarga la vista o edita la tarea desde el módulo principal de Tareas."/>
      </Card>;
    }
    return this.props.children;
  }
}
