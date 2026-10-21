import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './editor.css';
class ErrorBoundary extends Component<{children:ReactNode},{error:string}>{state={error:''};static getDerivedStateFromError(error:Error){return{error:error.message};}componentDidCatch(error:Error,info:ErrorInfo){console.error(error,info);}render(){return this.state.error?<div className="fatal-error"><h1>Не удалось открыть приложение</h1><p>{this.state.error}</p><p>Сохранённые заметки остались в локальном хранилище.</p><button className="button primary" onClick={()=>location.reload()}>Перезагрузить</button></div>:this.props.children;}}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
