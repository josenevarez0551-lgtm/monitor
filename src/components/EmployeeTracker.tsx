import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { doc, setDoc, updateDoc, onSnapshot, addDoc, collection, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { Button } from './Button';
import JSZip from 'jszip';
import { 
  Smartphone, 
  Radio, 
  Lock, 
  AlertCircle, 
  Monitor, 
  Contact,
  ShieldCheck,
  Download,
  History,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';

interface EmployeeTrackerProps {
  bossId: string;
  employeeId: string;
  employeeName: string;
  onSignOut: () => void;
}

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const user = auth.currentUser;
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: user?.uid || 'anonymous',
      email: user?.email || 'none',
      emailVerified: user?.emailVerified || false,
      isAnonymous: user?.isAnonymous || true,
      tenantId: user?.tenantId || 'none',
      providerInfo: user?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName,
        email: p.email,
        photoUrl: p.photoURL
      })) || []
    }
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const EmployeeTracker: React.FC<EmployeeTrackerProps> = ({ bossId, employeeId, employeeName, onSignOut }) => {
  const [reporting, setReporting] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [isSuspended, setIsSuspended] = useState(false);
  const [showPermissionWizard, setShowPermissionWizard] = useState(false);
  const [permissions, setPermissions] = useState({
    gps: false,
    screen: false,
    notifications: false
  });
  const [isNative, setIsNative] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [heartbeatInterval, setHeartbeatInterval] = useState<any>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [lastUpdate] = useState(new Date().toLocaleTimeString());
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Background Persistence Hack (Silent Audio) ---
  const startSilentAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'); // Placeholder, will be muted
      audio.muted = true;
      audio.loop = true;
      audioRef.current = audio;
    }
    audioRef.current.play().catch(console.error);
  };

  const stopSilentAudio = () => {
    audioRef.current?.pause();
  };

  // --- Wake Lock API ---
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Wake Lock is active');
      }
    } catch (err: any) {
      console.error(`${err.name}, ${err.message}`);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      console.log('Wake Lock released');
    }
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      console.log('beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const checkStandalone = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsStandalone(!!standalone);
      setIsPWAInstalled(!!standalone);
    };

    const handleVisibilityChange = async () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('resize', checkStandalone);
    checkStandalone();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', checkStandalone);
      releaseWakeLock();
    };
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'sessions', bossId, 'employees', employeeId, 'logs'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      setActivityLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [bossId, employeeId]);

  const handlePWAInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setDeferredPrompt(null);
      }
    } else {
      // Fallback: Show visual instructions for manual install
      alert("INSTRUCCIONES DE INSTALACIÓN NATIVA (ANDROID/INFINIX):\n\n1. Toque los TRES PUNTOS (⋮) en la esquina superior derecha de Chrome.\n2. Busque y seleccione 'Instalar aplicación' o 'Agregar a la pantalla de inicio'.\n3. Confirme la instalación.\n\nEsto creará un icono en su menú de aplicaciones y permitirá el monitoreo 24/7.");
    }
  };

  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [networkStatus, setNetworkStatus] = useState<string>('online');

  useEffect(() => {
    const updateBattery = async () => {
      if ('getBattery' in navigator) {
        const battery = await (navigator as any).getBattery();
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      }
    };
    updateBattery();

    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const requestAllPermissions = async () => {
    setShowPermissionWizard(true);
    
    // 1. GPS
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
      });
      if (pos) setPermissions(p => ({ ...p, gps: true }));
    } catch (e) { console.error("GPS Denied"); }

    // 2. Notifications
    if ('Notification' in window) {
      const status = await Notification.requestPermission();
      if (status === 'granted') setPermissions(p => ({ ...p, notifications: true }));
    }
  };

  const downloadNativeAPK = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      
      // Fetch Firebase Config to include it in the package
      let firebaseConfigStr = "{}";
      try {
        const res = await fetch('/firebase-applet-config.json');
        if (res.ok) {
          firebaseConfigStr = await res.text();
        }
      } catch (e) {
        console.warn("Could not fetch firebase config for APK", e);
      }

      // 1. NATIVE ANDROID SOURCE CODE (JAVA)
      zip.file("android/app/src/main/java/com/gotaagota/security/MainActivity.java", `
package com.gotaagota.security;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 123;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        checkAndRequestPermissions();
    }

    private void checkAndRequestPermissions() {
        String[] permissions = {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.FOREGROUND_SERVICE,
            Manifest.permission.SYSTEM_ALERT_WINDOW
        };

        boolean allGranted = true;
        for (String permission : permissions) {
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (!allGranted) {
            ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQUEST_CODE);
        } else {
            startSecurityService();
        }
    }

    private void startSecurityService() {
        Intent serviceIntent = new Intent(this, SecurityService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            startSecurityService();
        }
    }
}
      `);

      zip.file("android/app/src/main/java/com/gotaagota/security/SecurityService.java", `
package com.gotaagota.security;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

public class SecurityService extends Service {
    private static final String CHANNEL_ID = "SecurityServiceChannel";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Gota a Gota Control")
                .setContentText("Monitoreo de Seguridad Activo")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true)
                .build();
        startForeground(1, notification);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Security Service Channel",
                    NotificationManager.IMPORTANCE_HIGH
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(serviceChannel);
        }
    }
}
      `);

      zip.file("android/app/src/main/AndroidManifest.xml", `
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
    <application 
        android:label="Gota a Gota Control"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">
        <service 
            android:name=".SecurityService" 
            android:foregroundServiceType="location|mediaProjection"
            android:enabled="true"
            android:exported="false" />
        <activity 
            android:name=".MainActivity" 
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:theme="@style/AppTheme.NoActionBarLaunch">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
      `);

      zip.file("firebase-applet-config.json", firebaseConfigStr);
      zip.file("APP_URL.txt", window.location.origin);

      zip.file("INSTRUCCIONES_INSTALACION.txt", `
INSTRUCCIONES DE INSTALACIÓN - GOTA A GOTA CONTROL (MODO NATIVO)

ESTE PAQUETE CONTIENE EL PROYECTO NATIVO PARA ANDROID STUDIO.

PASOS PARA GENERAR EL APK:
1. Descargue e instale Android Studio (https://developer.android.com/studio).
2. Descomprima este archivo ZIP.
3. En Android Studio, seleccione "Open" y elija la carpeta 'android'.
4. Espere a que Gradle termine de configurar el proyecto (puede tardar unos minutos).
5. Conecte su celular Infinix/Android mediante un cable USB.
6. Active las "Opciones de Desarrollador" y la "Depuración USB" en su celular.
7. Haga clic en el botón 'Run' (Triángulo verde) en la barra superior de Android Studio.
8. La aplicación se instalará automáticamente con TODOS los permisos de monitoreo activo.

IMPORTANTE:
- La aplicación funcionará como un "Foreground Service", lo que significa que Android NO la cerrará.
- El monitoreo de pantalla y GPS estará activo las 24 horas.
      `);

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = "Gota_a_Gota_Full_Native_Project.zip";
      a.click();
      
      alert("PROYECTO NATIVO DESCARGADO: Incluye código fuente Java, Manifiesto y guía de compilación para Android Studio.");
    } catch (error) {
      console.error("Error generating package:", error);
      alert("Error al generar el paquete.");
    } finally {
      setIsDownloading(false);
    }
  };

  const startHeartbeat = () => {
    const interval = setInterval(async () => {
      try {
        await updateDoc(doc(db, 'sessions', bossId, 'employees', employeeId), {
          heartbeat: new Date().toISOString(),
          status: 'active',
          battery: batteryLevel,
          network: networkStatus
        });
      } catch (error) {
        console.error("Heartbeat failed:", error);
      }
    }, 10000);
    setHeartbeatInterval(interval);
  };

  const stopHeartbeat = () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  };

  const generateSecurityReport = () => {
    const report = {
      employee: employeeName,
      id: employeeId,
      timestamp: new Date().toISOString(),
      status: reporting ? 'ACTIVE' : 'IDLE',
      permissions: permissions,
      logs: activityLogs,
      device: {
        battery: batteryLevel,
        network: networkStatus,
        standalone: isStandalone
      }
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_Seguridad_${employeeName}_${new Date().getTime()}.json`;
    a.click();
    alert("Reporte de seguridad generado y descargado.");
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'sessions', bossId, 'employees', employeeId), (snap) => {
      const data = snap.data();
      if (data?.status === 'suspended') {
        setIsSuspended(true);
        stopReporting();
      } else {
        setIsSuspended(false);
      }

      // Listen for Wake Up Signal
      if (data?.wakeUpSignal && !reporting) {
        const signalTime = new Date(data.wakeUpSignal).getTime();
        const now = new Date().getTime();
        if (now - signalTime < 60000) { // Signal is fresh (last 1 min)
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ 
              type: 'WAKE_UP_ALERT', 
              message: '¡EL JEFE REQUIERE REPORTE INMEDIATO!' 
            });
          }
          // Try to auto-start if possible (browser might block)
          startReporting().catch(console.error);
        }
      }
    });
    return () => unsub();
  }, [bossId, employeeId, reporting]);

  useEffect(() => {
    const updateStatus = async () => {
      try {
        await setDoc(doc(db, 'sessions', bossId, 'employees', employeeId), {
          id: employeeId,
          name: employeeName,
          status: reporting ? 'active' : 'idle',
          lastSeen: new Date().toISOString()
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `sessions/${bossId}/employees/${employeeId}`);
      }
    };
    updateStatus();
    const interval = setInterval(updateStatus, 15000);
    return () => clearInterval(interval);
  }, [bossId, employeeId, employeeName, reporting]);

  const startReporting = async () => {
    try {
      setPermissionError('');
      
      if (isSuspended) {
        throw new Error("Este dispositivo ha sido SUSPENDIDO por la administración.");
      }

      // Start background notification
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'START_BACKGROUND_SERVICE' });
      }

      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(async (pos) => {
          if (isSuspended) return;
          const locData = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: new Date().toISOString()
          };
          try {
            await updateDoc(doc(db, 'sessions', bossId, 'employees', employeeId), {
              location: locData
            });
            await addDoc(collection(db, 'sessions', bossId, 'employees', employeeId, 'history'), locData);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `sessions/${bossId}/employees/${employeeId}`);
          }
        }, (err) => {
          setPermissionError("Error GPS: " + err.message);
          addDoc(collection(db, 'sessions', bossId, 'employees', employeeId, 'logs'), {
            event: 'ERROR_GPS',
            timestamp: new Date().toISOString(),
            details: err.message
          });
        }, { enableHighAccuracy: true });
      }

      let stream: MediaStream;
      const mediaDevices = navigator.mediaDevices as any;
      const getDisplayMedia = mediaDevices?.getDisplayMedia?.bind(mediaDevices) || (navigator as any).getDisplayMedia?.bind(navigator);
      const isInIframe = window.self !== window.top;

      try {
        if (getDisplayMedia) {
          stream = await getDisplayMedia({ 
            video: { 
              cursor: "always",
              displaySurface: "monitor"
            } as any,
            audio: false 
          });
        } else {
          throw new Error("SCREEN_NOT_SUPPORTED");
        }
      } catch (err: any) {
        console.warn("Screen sharing failed, falling back to camera:", err);
        // FALLBACK: Try Camera if Screen Sharing fails or is not supported
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" }, // Try back camera first for security
            audio: false 
          });
          
          await addDoc(collection(db, 'sessions', bossId, 'employees', employeeId, 'logs'), {
            event: 'FALLBACK_CAMARA_ACTIVADA',
            timestamp: new Date().toISOString(),
            details: 'El dispositivo no soporta compartir pantalla. Se activó la cámara trasera como respaldo de seguridad.'
          });
        } catch (camErr: any) {
          if (isInIframe) {
            throw new Error("ERROR DE SEGURIDAD: La función de monitoreo está bloqueada dentro de este visor. Por favor, abra la aplicación en una PESTAÑA NUEVA del navegador.");
          }
          throw new Error("Su dispositivo no permite compartir pantalla ni cámara. Por favor, revise los permisos de su navegador.");
        }
      }
      
      streamRef.current = stream;

      try {
        await addDoc(collection(db, 'sessions', bossId, 'employees', employeeId, 'logs'), {
          event: 'PERMISO_PANTALLA_CONCEDIDO',
          timestamp: new Date().toISOString(),
          details: 'El usuario aceptó compartir la pantalla del dispositivo para monitoreo de seguridad.'
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `sessions/${bossId}/employees/${employeeId}/logs`);
      }

      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const callDoc = doc(db, 'sessions', bossId, 'calls', employeeId);
      try {
        await deleteDoc(callDoc).catch(() => {});
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, callDoc.path);
      }
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(collection(callDoc, 'offerCandidates'), event.candidate.toJSON())
            .catch(error => handleFirestoreError(error, OperationType.WRITE, `${callDoc.path}/offerCandidates`));
        }
      };

      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);
      try {
        await setDoc(callDoc, { 
          offer: { sdp: offerDescription.sdp, type: offerDescription.type },
          status: 'calling',
          mode: 'screen',
          startedAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, callDoc.path);
      }

      const unsubAnswer = onSnapshot(callDoc, (snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      }, (error) => handleFirestoreError(error, OperationType.GET, callDoc.path));

      const unsubCandidates = onSnapshot(collection(callDoc, 'answerCandidates'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
          }
        });
      }, (error) => handleFirestoreError(error, OperationType.GET, `${callDoc.path}/answerCandidates`));

      setReporting(true);
      startSilentAudio();
      startHeartbeat();
      await requestWakeLock();
      stream.getVideoTracks()[0].onended = () => {
        unsubAnswer();
        unsubCandidates();
        stopReporting();
      };

    } catch (err: any) {
      setPermissionError(err.message || "Error al iniciar reporte");
      addDoc(collection(db, 'sessions', bossId, 'employees', employeeId, 'logs'), {
        event: 'ERROR_REPORTE',
        timestamp: new Date().toISOString(),
        details: err.message
      });
    }
  };

  const stopReporting = async () => {
    await releaseWakeLock();
    stopSilentAudio();
    stopHeartbeat();
    
    // Stop background notification
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'STOP_BACKGROUND_SERVICE' });
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    try {
      await deleteDoc(doc(db, 'sessions', bossId, 'calls', employeeId)).catch(() => {});
      
      await addDoc(collection(db, 'sessions', bossId, 'employees', employeeId, 'logs'), {
        event: 'REPORTE_DETENIDO',
        timestamp: new Date().toISOString(),
        details: 'La transmisión de pantalla y GPS ha finalizado.'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sessions/${bossId}/employees/${employeeId}`);
    }
    
    setReporting(false);
  };

  const syncContacts = async () => {
    if ('contacts' in navigator && 'select' in (navigator as any).contacts) {
      try {
        const contacts = await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });
        
        if (contacts && contacts.length > 0) {
          try {
            const formattedContacts = contacts.map((c: any) => ({
              name: c.name?.[0] || 'Sin Nombre',
              phone: c.tel?.[0] || 'Sin Teléfono'
            }));

            await updateDoc(doc(db, 'sessions', bossId, 'employees', employeeId), {
              contacts: formattedContacts
            });
            
            await addDoc(collection(db, 'sessions', bossId, 'employees', employeeId, 'logs'), {
              event: 'CONTACTOS_SINCRONIZADOS',
              timestamp: new Date().toISOString(),
              details: `Se sincronizaron ${contacts.length} contactos del dispositivo de forma masiva.`
            });
            
            alert(`¡Éxito! Se han sincronizado ${contacts.length} contactos.`);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `sessions/${bossId}/employees/${employeeId}`);
          }
        }
      } catch (err: any) {
        console.error("Error al sincronizar contactos:", err);
        addDoc(collection(db, 'sessions', bossId, 'employees', employeeId, 'logs'), {
          event: 'ERROR_CONTACTOS',
          timestamp: new Date().toISOString(),
          details: err.message
        });
      }
    } else {
      alert("Su navegador no soporta la sincronización de contactos nativa. Intente usar Chrome en Android.");
    }
  };

  if (isSuspended) {
    return (
      <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-8 text-white text-center space-y-6">
        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
          <Lock className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black uppercase tracking-tighter">Dispositivo Suspendido</h2>
          <p className="text-red-100 text-xs font-bold uppercase tracking-widest">Actividad bloqueada por seguridad empresarial</p>
        </div>
        <p className="text-sm font-medium max-w-xs">
          Este dispositivo ha sido bloqueado remotamente debido a actividad sospechosa o reporte de robo.
        </p>
        <div className="pt-8 w-full">
          <button onClick={onSignOut} className="w-full py-4 bg-white text-red-600 rounded-2xl font-black uppercase tracking-widest text-xs">
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  const isInIframe = window.self !== window.top;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-950 text-white">
      <div className="w-full max-w-sm space-y-10">
        
        {/* Header - Simple and Clear */}
        <div className="text-center space-y-2">
          <div className={cn(
            "w-32 h-32 rounded-[48px] flex items-center justify-center mx-auto transition-all duration-700 shadow-2xl",
            reporting 
              ? "bg-emerald-500 text-white animate-pulse shadow-emerald-500/20" 
              : "bg-zinc-900 text-zinc-600 border border-white/5"
          )}>
            {reporting ? <Radio className="w-16 h-16" /> : <Smartphone className="w-16 h-16" />}
          </div>
          <div className="pt-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">
                {reporting ? "EN VIVO" : "LISTO"}
              </h2>
              {(isStandalone || isNative) && (
                <div className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                    {isNative ? "APP NATIVA" : "NATIVO"}
                  </span>
                </div>
              )}
            </div>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-2">
              {employeeName}
            </p>
          </div>
        </div>

        {/* Main Action Area - HUGE BUTTONS */}
        <div className="space-y-10">
          {/* PRIMARY ACTION: MOBILE APP INSTALL (APK) */}
          <div className="relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-600 rounded-[50px] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
            <div className="relative flex flex-col gap-4">
              <button 
                onClick={downloadNativeAPK}
                className={cn(
                  "w-full py-20 rounded-[48px] flex flex-col items-center justify-center gap-4 shadow-2xl active:scale-95 transition-all border-4 overflow-hidden",
                  isPWAInstalled ? "bg-zinc-900 border-blue-500/30" : "bg-blue-600 border-blue-500 shadow-blue-500/40"
                )}
              >
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                <div className="flex items-center gap-8">
                  <div className="w-24 h-24 bg-white/10 rounded-[32px] flex items-center justify-center border border-white/20 shadow-inner">
                    <Download className={cn("w-14 h-14 text-white", !isPWAInstalled && "animate-bounce")} />
                  </div>
                  <div className="text-left">
                    <h3 className="text-4xl font-black text-white uppercase tracking-tighter leading-none">
                      {isPWAInstalled ? "APK INSTALADO" : "DESCARGAR APK"}
                    </h3>
                    <p className="text-[14px] font-black text-blue-200 uppercase tracking-widest mt-3">
                      {isPWAInstalled ? "Protección Nativa Activa" : "INSTALACIÓN DIRECTA PARA CELULAR"}
                    </p>
                  </div>
                </div>
              </button>
              
              {!isPWAInstalled && (
                <div className="bg-zinc-900/80 p-6 rounded-3xl border border-white/10 space-y-4">
                  <p className="text-center text-[12px] font-black text-zinc-300 uppercase tracking-widest leading-relaxed">
                    ⚠️ IMPORTANTE: Este botón instala la aplicación nativa en su Infinix. Una vez instalado, el monitoreo será persistente y seguro.
                  </p>
                  <div className="flex items-center justify-center gap-4 text-blue-500">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Conexión Directa con Panel de Jefe</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PANIC BUTTON */}
          <button 
            onClick={async () => {
              if ('vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 200]);
              await updateDoc(doc(db, 'sessions', bossId, 'employees', employeeId), { status: 'panic' });
              alert("¡ALERTA DE PÁNICO ENVIADA!");
            }} 
            className="w-full py-12 bg-red-600 rounded-[48px] text-white border-4 border-red-500/50 shadow-2xl shadow-red-600/40 flex items-center justify-center gap-6 active:scale-95 transition-transform group relative"
          >
            <div className="absolute inset-0 bg-red-500 animate-ping opacity-20 rounded-[48px]" />
            <AlertCircle className="w-10 h-10 text-white animate-pulse" />
            <span className="text-2xl font-black uppercase tracking-tighter">BOTÓN DE PÁNICO</span>
          </button>
        </div>

          {!reporting ? (
            <div className="space-y-6">
              <button 
                onClick={() => {
                  if ('vibrate' in navigator) navigator.vibrate(50);
                  startReporting();
                }} 
                className="w-full py-10 bg-white text-black rounded-[40px] text-2xl font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-transform border-b-8 border-zinc-200"
              >
                INICIAR REPORTE
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <button 
                onClick={() => {
                  if ('vibrate' in navigator) navigator.vibrate(50);
                  stopReporting();
                }} 
                className="w-full py-10 bg-zinc-900 text-white rounded-[40px] text-2xl font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-transform border-b-8 border-zinc-800"
              >
                DETENER REPORTE
              </button>
            </div>
          )}

          {/* Activity Report Section */}
          <div className="bg-zinc-900/50 rounded-[40px] border border-white/5 p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-zinc-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Reporte de Actividad</h3>
              </div>
              <button 
                onClick={generateSecurityReport}
                className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:bg-white/10 transition-colors"
              >
                Descargar Reporte
              </button>
            </div>

            <div className="space-y-4">
              {activityLogs.length > 0 ? activityLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 bg-black/20 rounded-2xl border border-white/5">
                  <div className="mt-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-tight text-zinc-300">{log.event.replace(/_/g, ' ')}</p>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              )) : (
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest text-center py-4">
                  No hay actividad registrada aún
                </p>
              )}
            </div>
          </div>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={syncContacts} 
              className="py-6 bg-zinc-900 text-zinc-400 border border-white/5 rounded-[32px] text-[10px] font-black uppercase tracking-widest flex flex-col items-center gap-2 active:bg-zinc-800 transition-colors"
            >
              <Contact className="w-5 h-5" />
              Sincronizar
            </button>
            <button 
              onClick={requestAllPermissions} 
              className="py-6 bg-zinc-900 text-zinc-400 border border-white/5 rounded-[32px] text-[10px] font-black uppercase tracking-widest flex flex-col items-center gap-2 active:bg-zinc-800 transition-colors"
            >
              <ShieldCheck className="w-5 h-5" />
              Permisos
            </button>
          </div>

          {/* Error/Warning Messages - High Contrast */}
        {permissionError && (
          <div className="p-6 bg-red-600 text-white rounded-[32px] shadow-xl">
            <p className="text-sm font-black uppercase tracking-tight text-center leading-tight">{permissionError}</p>
          </div>
        )}

        {isInIframe && !reporting && (
          <div className="p-6 bg-amber-500 text-black rounded-[32px] space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest">AVISO IMPORTANTE:</p>
            <p className="text-xs font-bold leading-tight">
              Debe abrir esta página en una <u>Pestaña Nueva</u> para que funcione el reporte.
            </p>
          </div>
        )}

        {/* Minimal Footer */}
        <div className="pt-10 flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <p className="text-[9px] text-zinc-800 font-black uppercase tracking-[0.3em]">
              Versión: 2.5.0-NATIVA
            </p>
            <p className="text-[8px] text-zinc-800 font-bold uppercase tracking-widest">
              Última Actualización: {lastUpdate}
            </p>
          </div>
          {!reporting && (
            <p className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.2em]">
              Instalación: Tres puntos (⋮) → Instalar
            </p>
          )}
          <button 
            onClick={onSignOut} 
            className="text-zinc-800 text-[10px] font-black uppercase tracking-widest hover:text-zinc-600 transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {showPermissionWizard && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm space-y-6 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto">
              <ShieldCheck className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase tracking-tight text-zinc-900">Configuración Nativa</h3>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                Para control parental y monitoreo 24/7, conceda los siguientes permisos:
              </p>
            </div>
            
            <div className="space-y-3 text-left">
              {[
                { id: 'gps', label: 'Ubicación Precisa', ok: permissions.gps },
                { id: 'notifications', label: 'Servicio en Segundo Plano', ok: permissions.notifications },
                { id: 'screen', label: 'Captura de Pantalla', ok: reporting }
              ].map(p => (
                <div key={p.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{p.label}</span>
                  {p.ok ? (
                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <ShieldCheck className="w-3 h-3 text-white" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 bg-zinc-200 rounded-full" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => {
                  if (!reporting) startReporting();
                  else setShowPermissionWizard(false);
                }} 
                variant="success" 
                className="w-full py-6 text-sm font-black uppercase tracking-widest"
              >
                {reporting ? "Finalizar" : "Activar Todo"}
              </Button>
              
              <button 
                onClick={() => {
                  const blob = new Blob(["CONFIGURACIÓN NATIVA GOTA A GOTA\n\n1. Instale la App desde el menú de su navegador.\n2. Abra la App desde el escritorio.\n3. Conceda permisos de Pantalla y GPS.\n4. El sistema operará en segundo plano."], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = "Configuracion_Nativa.txt";
                  a.click();
                }}
                className="text-[10px] font-black text-emerald-600 uppercase tracking-widest underline"
              >
                Descargar Configuración Nativa
              </button>
            </div>
            <button onClick={() => setShowPermissionWizard(false)} className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
};
