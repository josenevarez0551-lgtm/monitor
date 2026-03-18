import React, { Component } from 'react';
import { Button } from './Button';
import { AlertCircle } from 'lucide-react';

export class ErrorBoundary extends Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    const { hasError, error } = (this as any).state;
    if (hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-red-50 p-8 rounded-3xl border border-red-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-6 h-6" />
              <h2 className="text-lg font-black uppercase tracking-tight">Error del Sistema</h2>
            </div>
            <p className="text-zinc-600 text-sm">Ha ocurrido un error inesperado. Por favor, recargue la página.</p>
            <div className="p-4 bg-white/50 rounded-2xl text-[10px] font-mono text-zinc-500 break-all">
              {String(error)}
            </div>
            <Button onClick={() => window.location.reload()} variant="danger" className="w-full">
              Recargar Aplicación
            </Button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}