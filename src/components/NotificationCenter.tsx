import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellOff, Check, Trash2, Flame, ShieldAlert, Sparkles, CheckCircle, Info } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationCenterProps {
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onDeleteNotification: (id: string) => void;
  onClearAll: () => void;
  onSendTestNotification: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  onMarkAllRead,
  onMarkRead,
  onDeleteNotification,
  onClearAll,
  onSendTestNotification
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync notification permissions from browser
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Request browser permission
  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert('Seu navegador não suporta notificações de área de trabalho.');
      return;
    }
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.lida).length;

  const getIcon = (tipo: AppNotification['tipo']) => {
    switch (tipo) {
      case 'ofensiva':
        return <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />;
      case 'alerta':
        return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case 'sucesso':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBgColor = (tipo: AppNotification['tipo']) => {
    switch (tipo) {
      case 'ofensiva':
        return 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40';
      case 'alerta':
        return 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40';
      case 'sucesso':
        return 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40';
      default:
        return 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40';
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative" ref={containerRef} id="notification-center-container">
      {/* Trigger Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl hover:shadow-2xs cursor-pointer text-slate-500 dark:text-slate-400 transition-all font-bold"
        title="Central de Notificações"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white ring-2 ring-white dark:ring-slate-900 animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            {/* Popover Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-between items-center">
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  Notificações do Sistema
                </h4>
                <p className="text-[10px] text-slate-450 dark:text-slate-500">
                  {unreadCount} pendentes hoje
                </p>
              </div>
              <div className="flex gap-1.5">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[9px] font-bold uppercase transition-colors"
                    title="Marcar todas como lidas"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={onClearAll}
                    className="p-1 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400 text-slate-450 dark:text-slate-550 rounded-lg text-[9px] font-bold uppercase transition-colors"
                    title="Limpar todas"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Browser Permission Controls */}
            <div className="px-4 py-3 bg-purple-50/50 dark:bg-purple-950/10 border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {permission === 'granted' ? (
                  <Bell className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : permission === 'denied' ? (
                  <BellOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
                ) : (
                  <Bell className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <div className="leading-tight">
                  <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase">Notificação Push</p>
                  <p className="text-[8px] text-slate-400 dark:text-slate-500">
                    {permission === 'granted' ? 'Autorizado no Navegador' :
                     permission === 'denied' ? 'Bloqueado no Navegador' : 'Aguardando Ativação'}
                  </p>
                </div>
              </div>
              {permission === 'default' ? (
                <button
                  onClick={requestPermission}
                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[8px] uppercase tracking-wide rounded-lg transition-colors cursor-pointer"
                >
                  Permitir
                </button>
              ) : (
                <button
                  onClick={onSendTestNotification}
                  className="px-2 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-extrabold text-[8px] uppercase tracking-wide rounded-lg transition-colors cursor-pointer"
                >
                  Testar Envio
                </button>
              )}
            </div>

            {/* List Body */}
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-150 dark:divide-slate-800/80 scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-400 dark:text-slate-500 space-y-1.5">
                  <Bell className="w-6 h-6 mx-auto stroke-1.5 text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-semibold">Tudo calmo por aqui!</p>
                  <p className="text-[9px] max-w-[200px] mx-auto leading-relaxed">
                    Você será alertado quando estourar o limite 50-30-20, quando sua ofensiva estiver em risco ou ao completar metas!
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {notifications.map((n) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`p-3 transition-colors relative group flex gap-2.5 ${
                        n.lida ? 'bg-white dark:bg-slate-900 opacity-60' : 'bg-slate-50/65 dark:bg-slate-900/35'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${getBgColor(n.tipo)}`}>
                        {getIcon(n.tipo)}
                      </div>
                      <div className="flex-1 min-w-0 pr-6" onClick={() => !n.lida && onMarkRead(n.id)}>
                        <div className="flex justify-between items-baseline gap-1">
                          <p className={`text-[10px] font-black truncate ${n.lida ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                            {n.titulo}
                          </p>
                          <span className="text-[8px] text-slate-400 dark:text-slate-650 shrink-0">
                            {formatTime(n.data)}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed font-medium">
                          {n.mensagem}
                        </p>
                      </div>

                      {/* Dismiss Hover Trigger */}
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!n.lida && (
                          <button
                            onClick={() => onMarkRead(n.id)}
                            className="p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-emerald-500 text-slate-400 rounded-md transition-all shadow-xs cursor-pointer"
                            title="Marcar como lida"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteNotification(n.id)}
                          className="p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-red-500 text-slate-400 rounded-md transition-all shadow-xs cursor-pointer"
                          title="Remover"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
