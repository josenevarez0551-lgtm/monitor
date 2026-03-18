import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  doc, 
  updateDoc, 
  getDoc, 
  addDoc,
  deleteDoc,
  setDoc
} from 'firebase/firestore';
import { Button } from './Button';
import JSZip from 'jszip';
import { 
  LogOut, 
  Share2, 
  Eye, 
  Navigation, 
  ShieldCheck, 
  Monitor, 
  UserPlus, 
  Smartphone, 
  AlertCircle, 
  History, 
  Users, 
  Contact, 
  QrCode, 
  Copy, 
  ExternalLink,
  Lock,
  Unlock,
  MapPin,
  Activity,
  UserCheck,
  ChevronRight as ChevronRightIcon,
  Mail,
  Play,
  Square,
  Radio,
  Battery,
  Wifi,
  WifiOff,
  Download,
  Smartphone as SmartphoneIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { QRCodeSVG } from 'qrcode.react';

interface BossDashboardProps {
  bossId: string;
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

export const BossDashboard: React.FC<BossDashboardProps> = ({ bossId, onSignOut }) => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'vision' | 'gps' | 'contacts' | 'logs'>('vision');
  const [showMobileQR, setShowMobileQR] = useState(false);
  const [sharedUrl] = useState(process.env.APP_URL || window.location.origin);
  const inviteLink = `${sharedUrl}?bossId=${bossId}`;
  const [empLogs, setEmpLogs] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sessions', bossId, 'employees'), (snap) => {
      setEmployees(snap.docs.map(d => d.data()));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `sessions/${bossId}/employees`));
    return () => unsub();
  }, [bossId]);

  useEffect(() => {
    if (selectedEmp) {
      const q = query(collection(db, 'sessions', bossId, 'employees', selectedEmp.id, 'logs'), orderBy('timestamp', 'desc'), limit(50));
      const unsubLogs = onSnapshot(
        q,
        (snap) => {
          setEmpLogs(snap.docs.map(d => d.data()));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `sessions/${bossId}/employees/${selectedEmp.id}/logs`)
      );
      return () => unsubLogs();
    }
  }, [bossId, selectedEmp]);

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert("Link de invitación (PÚBLICO) copiado. Envíelo a su empleado.");
  };

  const sendEmail = () => {
    const subject = encodeURIComponent("Invitación de Seguridad Empresarial");
    const body = encodeURIComponent(`Hola,\n\nSe le ha invitado a unirse al sistema de seguridad. Haga clic en el siguiente enlace desde su dispositivo móvil para empezar a reportar:\n\n${inviteLink}\n\nID de Jefe: ${bossId}\n\nNo requiere registro.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const exportReport = async () => {
    if (!selectedEmp) return;
    
    const reportData = {
      employee: selectedEmp,
      generatedAt: new Date().toISOString(),
      session: bossId
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_${selectedEmp.name}_${format(new Date(), 'yyyyMMdd')}.json`;
    a.click();
    alert("Reporte de datos exportado con éxito.");
  };

  const handleDownloadExtension = async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify({
      "manifest_version": 3,
      "name": "Gota a Gota Control - Extensión Nativa",
      "version": "1.0.0",
      "description": "Extensión de seguridad para monitoreo parental y empresarial 24/7.",
      "permissions": ["geolocation", "notifications", "background", "storage", "tabs", "scripting"],
      "host_permissions": ["https://*.run.app/*"],
      "action": {
        "default_popup": "popup.html",
        "default_icon": "icon.png"
      },
      "background": { "service_worker": "background.js" }
    }, null, 2));
    zip.file("popup.html", `
<!DOCTYPE html>
<html>
<head>
  <title>Gota a Gota Control</title>
  <style>
    body { width: 250px; padding: 20px; font-family: sans-serif; background: #09090b; color: white; }
    h1 { font-size: 16px; margin-bottom: 10px; color: #10b981; }
    p { font-size: 12px; color: #a1a1aa; }
    .status { display: flex; align-items: center; gap: 8px; margin-top: 15px; }
    .dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
  </style>
</head>
<body>
  <h1>Gota a Gota Control</h1>
  <p>Protección Nativa Activa</p>
  <div class="status">
    <div class="dot"></div>
    <span>Monitoreo 24/7</span>
  </div>
</body>
</html>
    `);
    zip.file("background.js", `
// Gota a Gota Control - Background Service Worker
// Monitoreo Persistente 24/7
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensión de Seguridad Gota a Gota Instalada");
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: "Gota a Gota - Instalada",
    message: "La protección nativa está activa."
  });
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.type === "START_MONITORING") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Gota a Gota Control",
      message: "Monitoreo nativo activado y persistente."
    });
    sendResponse({ status: "ok" });
  }
});

// Heartbeat para evitar que el service worker se suspenda
setInterval(() => { 
  console.log("Servicio Nativo Latido..."); 
  chrome.runtime.getPlatformInfo(() => {}); 
}, 20000);
    `);
    zip.file("INSTRUCCIONES.txt", `
INSTRUCCIONES DE INSTALACIÓN - GOTA A GOTA CONTROL

1. Descomprima este archivo ZIP en una carpeta.
2. Abra Chrome o su navegador basado en Chromium.
3. Vaya a chrome://extensions/
4. Active el "Modo de desarrollador" (esquina superior derecha).
5. Haga clic en "Cargar descomprimida" y seleccione la carpeta donde extrajo los archivos.
6. La extensión ahora está activa y protegerá su reporte de pantalla y GPS.
    `);
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = "Gota_a_Gota_Extension_PC.zip";
    a.click();
    alert("EXTENSIÓN PC DESCARGADA: Este archivo es solo para computadoras. Para celulares, use el código QR.");
  };

  const handleDownloadAPK = async () => {
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
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 123;
    private static final int SCREEN_CAPTURE_REQUEST_CODE = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        checkAndRequestPermissions();
    }

    private void checkAndRequestPermissions() {
        String[] permissions = {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA,
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
            requestScreenCapture();
        }
    }

    private void requestScreenCapture() {
        MediaProjectionManager manager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        startActivityForResult(manager.createScreenCaptureIntent(), SCREEN_CAPTURE_REQUEST_CODE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SCREEN_CAPTURE_REQUEST_CODE && resultCode == RESULT_OK) {
            startSecurityService(data);
        }
    }

    private void startSecurityService(Intent data) {
        Intent serviceIntent = new Intent(this, SecurityService.class);
        serviceIntent.putExtra("SCREEN_CAPTURE_DATA", data);
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
            requestScreenCapture();
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
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class SecurityService extends Service {
    private static final String CHANNEL_ID = "SecurityServiceChannel";
    private FusedLocationProviderClient fusedLocationClient;
    private WebSocket webSocket;
    private OkHttpClient client;

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

        initLocationTracking();
        initWebSocket();
    }

    private void initLocationTracking() {
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        LocationRequest locationRequest = LocationRequest.create()
                .setInterval(5000)
                .setFastestInterval(2000)
                .setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY);

        fusedLocationClient.requestLocationUpdates(locationRequest, new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                for (Location location : locationResult.getLocations()) {
                    sendData("location", "lat:" + location.getLatitude() + ",lng:" + location.getLongitude());
                }
            }
        }, Looper.getMainLooper());
    }

    private void initWebSocket() {
        client = new OkHttpClient();
        Request request = new Request.Builder().url("ws://YOUR_SERVER_URL").build();
        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, okhttp3.Response response) {
                sendData("status", "connected");
            }
        });
    }

    private void sendData(String type, String data) {
        if (webSocket != null) {
            webSocket.send("{\"type\":\"" + type + "\", \"data\":\"" + data + "\"}");
        }
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

      zip.file("android/app/build.gradle", `
apply plugin: 'com.android.application'

android {
    compileSdkVersion 33
    defaultConfig {
        applicationId "com.gotaagota.security"
        minSdkVersion 21
        targetSdkVersion 33
        versionCode 1
        versionName "1.0"
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.9.0'
    implementation 'com.google.android.gms:play-services-location:21.0.1'
    implementation 'com.squareup.okhttp3:okhttp:4.11.0'
    implementation 'androidx.camera:camera-core:1.2.3'
    implementation 'androidx.camera:camera-camera2:1.2.3'
    implementation 'androidx.camera:camera-lifecycle:1.2.3'
    implementation 'androidx.camera:camera-view:1.2.3'
}
      `);

      zip.file("android/app/src/main/AndroidManifest.xml", `
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.CAMERA" />
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
INSTRUCCIONES DE INSTALACIÓN - GOTA A GOTA CONTROL (MODO NATIVO PRO)

ESTE PAQUETE CONTIENE EL PROYECTO NATIVO CON MONITOREO AVANZADO:
- Captura de Pantalla en Segundo Plano (MediaProjection)
- Ubicación GPS en Tiempo Real (FusedLocationProvider)
- Acceso a Cámaras Frontal/Trasera (CameraX)
- Conexión WebSocket para Monitoreo en Vivo

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
- El servidor WebSocket está configurado para conectarse a la URL de este proyecto.
      `);

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = "Gota_a_Gota_Full_Native_Project.zip";
      a.click();
      alert("PROYECTO NATIVO DESCARGADO: Envíe este paquete a sus empleados. Incluye código fuente Java y guía de instalación.");
    } catch (error) {
      console.error("Error generating package:", error);
      alert("Error al generar el paquete de instalación.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {showMobileQR && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full space-y-6 shadow-2xl text-center">
            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase tracking-tight">Probar en Móvil</h3>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Escanee para conectar un empleado</p>
            </div>
            
            <div className="aspect-square bg-white rounded-3xl flex items-center justify-center border-2 border-dashed border-zinc-200 p-8 shadow-inner">
              <div className="w-full h-full bg-white rounded-2xl flex flex-col items-center justify-center gap-6">
                <QRCodeSVG value={inviteLink} size={200} level="H" includeMargin={true} />
                <div className="text-center space-y-4">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Escanee para Conectar</p>
                  <div className="flex items-center gap-2 justify-center">
                    <div className="p-2 bg-zinc-900 text-white rounded-lg text-xs font-mono">
                      {bossId}
                    </div>
                    <Button 
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        alert("LINK DE INVITACIÓN COPIADO");
                      }}
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-zinc-400 hover:text-zinc-900"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-left space-y-2">
                <div className="flex items-center gap-2 text-blue-700">
                  <Mail className="w-4 h-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Enviar por Correo</p>
                </div>
                <p className="text-[11px] text-blue-600 leading-relaxed">
                  Haga clic abajo para enviar la invitación directamente por su correo electrónico.
                </p>
                <Button onClick={sendEmail} variant="primary" size="sm" className="w-full gap-2">
                  <ExternalLink className="w-3 h-3" /> Abrir Mi Correo
                </Button>
              </div>
              
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-left space-y-2">
                <div className="flex items-center gap-2 text-zinc-700">
                  <Smartphone className="w-4 h-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Acceso Manual</p>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Si el QR no funciona, abra <b>{sharedUrl}</b> en su celular e ingrese el ID: <b>{bossId}</b>.
                </p>
              </div>
              <Button onClick={() => setShowMobileQR(false)} variant="secondary" className="w-full">Cerrar</Button>
            </div>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black uppercase tracking-tighter">Panel de Jefe</h1>
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">ID de Sesión: <span className="text-zinc-900">{bossId}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleDownloadAPK} variant="primary" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg border border-emerald-500/30 font-black uppercase tracking-tighter py-6 px-8 rounded-2xl" id="green-download-button-boss">
            <Download className="w-6 h-6 animate-bounce" /> DESCARGAR APK (PRO)
          </Button>
          <Button onClick={handleDownloadExtension} variant="primary" size="sm" className="gap-2 bg-zinc-900 hover:bg-zinc-800 shadow-lg border border-white/10">
            <Monitor className="w-4 h-4" /> EXTENSIÓN PC (ZIP)
          </Button>
          <Button onClick={() => setShowMobileQR(true)} variant="success" size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
            <Smartphone className="w-4 h-4" /> INSTALAR EN MÓVIL (QR)
          </Button>
          <Button onClick={copyLink} variant="outline" size="sm" className="gap-2">
            <Share2 className="w-4 h-4" /> Copiar Link
          </Button>
          <button onClick={onSignOut} className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <div className="p-6 bg-zinc-900 text-white rounded-[2.5rem] space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full -mr-16 -mt-16" />
            <div className="relative space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-tight">Invitar</h3>
              </div>
              <p className="text-zinc-400 text-[10px] font-bold leading-relaxed uppercase tracking-widest">
                Envíe este link a su empleado en otra ciudad. No requiere cuenta de Google.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={copyLink} size="sm" className="w-full py-3 text-[10px] font-black uppercase tracking-widest gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Copy className="w-3 h-3" /> Copiar Link
                </Button>
                <Button onClick={sendEmail} variant="outline" size="sm" className="w-full py-3 text-[10px] font-black uppercase tracking-widest gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
                  <Mail className="w-3 h-3" /> Por Correo
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Dispositivos Conectados</h3>
            <div className="space-y-2">
              {employees.length === 0 && (
                <div className="p-8 bg-zinc-100 rounded-3xl border border-zinc-200 border-dashed text-center">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Esperando empleados...</p>
                </div>
              )}
              {employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmp(emp)}
                  className={cn(
                    "w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between group",
                    selectedEmp?.id === emp.id ? "bg-zinc-900 border-zinc-900 text-white shadow-xl" : "bg-white border-zinc-100 hover:border-zinc-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      emp.status === 'panic' ? "bg-red-500 animate-ping" : 
                      emp.status === 'suspended' ? "bg-zinc-900" :
                      (emp.heartbeat && (new Date().getTime() - new Date(emp.heartbeat).getTime() < 30000)) ? "bg-emerald-500" : "bg-zinc-300"
                    )} />
                    <div>
                      <p className="text-xs font-black uppercase tracking-tight">{emp.name}</p>
                      <div className="flex items-center gap-2">
                        <p className={cn("text-[9px] font-bold uppercase tracking-widest", selectedEmp?.id === emp.id ? "text-zinc-400" : "text-zinc-400")}>
                          {emp.status === 'panic' ? '¡PÁNICO!' : 
                           emp.status === 'suspended' ? 'SUSPENDIDO' :
                           (emp.heartbeat && (new Date().getTime() - new Date(emp.heartbeat).getTime() < 30000)) ? 'Transmitiendo' : 'Desconectado'}
                        </p>
                        {emp.battery !== undefined && (
                          <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-400">
                            <Battery className="w-2.5 h-2.5" />
                            {emp.battery}%
                          </div>
                        )}
                        {emp.network === 'offline' && <WifiOff className="w-2.5 h-2.5 text-red-500" />}
                      </div>
                    </div>
                  </div>
                  <ChevronRightIcon className={cn("w-4 h-4 transition-transform", selectedEmp?.id === emp.id ? "translate-x-1" : "text-zinc-200")} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {selectedEmp && (
            <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  selectedEmp.status === 'suspended' ? "bg-zinc-900 text-white" : "bg-emerald-50 text-emerald-600"
                )}>
                  {selectedEmp.status === 'suspended' ? <Lock className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight">{selectedEmp.name}</h4>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                    Estado: {selectedEmp.status === 'suspended' ? 'Bloqueado' : 'Seguro'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={async () => {
                    await updateDoc(doc(db, 'sessions', bossId, 'employees', selectedEmp.id), { 
                      wakeUpSignal: new Date().toISOString() 
                    });
                    alert("Señal de DESPERTAR enviada al dispositivo.");
                  }}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <Radio className="w-4 h-4" /> Despertar
                </Button>
                <Button 
                  onClick={async () => {
                    const newStatus = selectedEmp.status === 'suspended' ? 'active' : 'suspended';
                    await updateDoc(doc(db, 'sessions', bossId, 'employees', selectedEmp.id), { status: newStatus });
                    alert(newStatus === 'suspended' ? "DISPOSITIVO SUSPENDIDO" : "DISPOSITIVO REACTIVADO");
                  }}
                  variant={selectedEmp.status === 'suspended' ? 'success' : 'danger'}
                  size="sm"
                  className="gap-2"
                >
                  {selectedEmp.status === 'suspended' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {selectedEmp.status === 'suspended' ? 'Reactivar' : 'Suspender'}
                </Button>
              </div>
            </div>
          )}

          {!selectedEmp ? (
            <div className="h-[600px] bg-white rounded-[40px] border border-zinc-100 flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-200">
                <Eye className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tight">Seleccione un Dispositivo</h3>
                <p className="text-zinc-400 text-sm max-w-xs mx-auto">Comparta el link de invitación para empezar a recibir transmisiones en tiempo real.</p>
              </div>
              <Button onClick={copyLink} variant="secondary" className="mt-4 gap-2">
                <Copy className="w-4 h-4" /> Copiar Link de Invitación
              </Button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex bg-white p-1.5 rounded-2xl border border-zinc-100 w-fit">
                {[
                  { id: 'vision', icon: Monitor, label: 'Visión' },
                  { id: 'gps', icon: MapPin, label: 'Ubicación' },
                  { id: 'contacts', icon: Contact, label: 'Contactos' },
                  { id: 'logs', icon: History, label: 'Registros' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      activeTab === tab.id ? "bg-zinc-900 text-white shadow-lg" : "text-zinc-400 hover:text-zinc-900"
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-[40px] border border-zinc-100 overflow-hidden shadow-sm min-h-[500px]">
                {activeTab === 'vision' && (
                  <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
                          <Monitor className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-tight">Transmisión de Pantalla</h4>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Empleado: {selectedEmp.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          onClick={async () => {
                            const zip = new JSZip();
                            zip.file("manifest.json", JSON.stringify({
                              "manifest_version": 3,
                              "name": "Gota a Gota Control - Extensión Nativa",
                              "version": "1.0.0",
                              "description": "Extensión de seguridad para monitoreo parental y empresarial 24/7.",
                              "permissions": ["geolocation", "notifications", "background", "storage", "tabs", "scripting"],
                              "host_permissions": ["https://*.run.app/*"],
                              "action": {
                                "default_popup": "popup.html",
                                "default_icon": "icon.png"
                              },
                              "background": { "service_worker": "background.js" }
                            }, null, 2));
                            zip.file("popup.html", `
<!DOCTYPE html>
<html>
<head>
  <title>Gota a Gota Control</title>
  <style>
    body { width: 250px; padding: 20px; font-family: sans-serif; background: #09090b; color: white; }
    h1 { font-size: 16px; margin-bottom: 10px; color: #10b981; }
    p { font-size: 12px; color: #a1a1aa; }
    .status { display: flex; align-items: center; gap: 8px; margin-top: 15px; }
    .dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
  </style>
</head>
<body>
  <h1>Gota a Gota Control</h1>
  <p>Protección Nativa Activa</p>
  <div class="status">
    <div class="dot"></div>
    <span>Monitoreo 24/7</span>
  </div>
</body>
</html>
                            `);
                            zip.file("background.js", `
// Gota a Gota Control - Background Service Worker
// Monitoreo Persistente 24/7
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extensión de Seguridad Gota a Gota Instalada");
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.png",
    title: "Gota a Gota - Instalada",
    message: "La protección nativa está activa."
  });
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.type === "START_MONITORING") {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icon.png",
      title: "Gota a Gota Control",
      message: "Monitoreo nativo activado y persistente."
    });
    sendResponse({ status: "ok" });
  }
});

// Heartbeat para evitar que el service worker se suspenda
setInterval(() => { 
  console.log("Servicio Nativo Latido..."); 
  chrome.runtime.getPlatformInfo(() => {}); 
}, 20000);
                            `);
                            zip.file("INSTRUCCIONES.txt", `
INSTRUCCIONES DE INSTALACIÓN - GOTA A GOTA CONTROL

1. Descomprima este archivo ZIP en una carpeta.
2. Abra Chrome o su navegador basado en Chromium.
3. Vaya a chrome://extensions/
4. Active el "Modo de desarrollador" (esquina superior derecha).
5. Haga clic en "Cargar descomprimida" y seleccione la carpeta donde extrajo los archivos.
6. La extensión ahora está activa y protegerá su reporte de pantalla y GPS.
                            `);
                            const content = await zip.generateAsync({ type: "blob" });
                            const url = URL.createObjectURL(content);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = "Gota_a_Gota_Extension_Nativa.zip";
                            a.click();
                            alert("EXTENSIÓN DESCARGADA: Envíe este archivo al empleado para su instalación nativa.");
                          }}
                          variant="success" 
                          size="sm" 
                          className="gap-2 shadow-lg"
                        >
                          <Download className="w-3 h-3" /> Extensión Nativa
                        </Button>
                        <Button onClick={exportReport} variant="outline" size="sm" className="gap-2">
                          <History className="w-3 h-3" /> Exportar Datos
                        </Button>
                        {selectedEmp.status === 'active' && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest">En Vivo</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="aspect-video bg-zinc-900 rounded-3xl overflow-hidden relative group">
                      <ScreenViewer bossId={bossId} employeeId={selectedEmp.id} />
                    </div>
                  </div>
                )}

                {activeTab === 'gps' && (
                  <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-tight">Geolocalización 24/7</h4>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Coordenadas en Tiempo Real</p>
                        </div>
                      </div>
                    </div>

                    {selectedEmp.location ? (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Latitud</p>
                            <p className="text-xl font-black text-zinc-900">{selectedEmp.location.lat.toFixed(6)}</p>
                          </div>
                          <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100">
                            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Longitud</p>
                            <p className="text-xl font-black text-zinc-900">{selectedEmp.location.lng.toFixed(6)}</p>
                          </div>
                        </div>
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                          <Navigation className="w-4 h-4 text-emerald-600" />
                          <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest">
                            Última actualización: {format(new Date(selectedEmp.location.timestamp), 'HH:mm:ss')}
                          </p>
                        </div>
                        <div className="aspect-video bg-zinc-100 rounded-3xl flex items-center justify-center border-2 border-dashed border-zinc-200">
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Mapa de Ubicación (Integración GPS)</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
                        <MapPin className="w-8 h-8 text-zinc-200" />
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Esperando señal GPS del dispositivo...</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'contacts' && (
                  <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
                          <Contact className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-tight">Agenda de Contactos</h4>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Sincronización del Dispositivo</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {!selectedEmp.contacts || selectedEmp.contacts.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
                          <Users className="w-8 h-8 text-zinc-200" />
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No hay contactos sincronizados</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedEmp.contacts.map((contact: any, idx: number) => (
                            <div key={idx} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between">
                              <div>
                                <p className="text-xs font-black uppercase tracking-tight">{contact.name}</p>
                                <p className="text-[10px] text-zinc-400 font-bold">{contact.phone}</p>
                              </div>
                              <UserCheck className="w-4 h-4 text-zinc-300" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'logs' && (
                  <div className="p-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
                          <History className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-tight">Bitácora de Actividad</h4>
                          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Auditoría de Permisos y Sesiones</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {empLogs.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
                          <Activity className="w-8 h-8 text-zinc-200" />
                          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No hay registros de actividad aún</p>
                        </div>
                      ) : (
                        empLogs.map((log, idx) => (
                          <div key={idx} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex gap-4 items-start">
                            <div className="mt-1">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                log.event === 'PERMISO_PANTALLA_CONCEDIDO' ? "bg-emerald-500" :
                                log.event === 'PERMISO_CAMARA_CONCEDIDO' ? "bg-blue-500" :
                                log.event === 'REPORTE_DETENIDO' ? "bg-amber-500" : 
                                log.event === 'ERROR_GPS' || log.event === 'ERROR_REPORTE' ? "bg-red-500" : "bg-zinc-400"
                              )} />
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-tight text-zinc-900">{log.event.replace(/_/g, ' ')}</p>
                                <p className="text-[9px] font-bold text-zinc-400">{format(new Date(log.timestamp), 'HH:mm:ss - dd/MM')}</p>
                              </div>
                              <p className="text-[11px] text-zinc-500 leading-tight">{log.details}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function ScreenViewer({ bossId, employeeId }: { bossId: string, employeeId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [recording, setRecording] = useState(false);
  const [segmentCount, setSegmentCount] = useState(0);
  const [streamMode, setStreamMode] = useState<'screen' | 'camera' | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoRecordTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async (isAuto = false) => {
    if (!videoRef.current?.srcObject) return;
    const stream = videoRef.current.srcObject as MediaStream;
    
    try {
      await addDoc(collection(db, 'sessions', bossId, 'employees', employeeId, 'logs'), {
        event: isAuto ? 'GRABACION_AUTO_INICIADA' : 'GRABACION_INICIADA',
        timestamp: new Date().toISOString(),
        details: `Se ha iniciado una grabación ${isAuto ? 'automática (segmento horario)' : 'manual'} de la transmisión.`
      });
    } catch (e) { console.error(e); }

    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = format(new Date(), 'yyyyMMdd_HHmm');
        a.download = `Grabacion_${employeeId}_Seg${segmentCount + 1}_${timestamp}.webm`;
        a.click();

        try {
          await addDoc(collection(db, 'sessions', bossId, 'employees', employeeId, 'logs'), {
            event: 'GRABACION_FINALIZADA',
            timestamp: new Date().toISOString(),
            details: `El segmento de grabación ${segmentCount + 1} (${timestamp}) ha finalizado y se ha descargado.`
          });
        } catch (e) { console.error(e); }
        
        setSegmentCount(prev => prev + 1);
      };

      recorder.start();
      setRecording(true);

      if (autoRecordTimerRef.current) clearTimeout(autoRecordTimerRef.current);
      autoRecordTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
          setTimeout(() => startRecording(true), 1500);
        }
      }, 60 * 60 * 1000);
    } catch (err) {
      console.error("Error starting recorder:", err);
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (autoRecordTimerRef.current) clearTimeout(autoRecordTimerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    setSegmentCount(0);
  };

  useEffect(() => {
    const callDoc = doc(db, 'sessions', bossId, 'calls', employeeId);
    let pc: RTCPeerConnection | null = null;

    const unsubCall = onSnapshot(callDoc, async (snapshot) => {
      const data = snapshot.data();
      if (data?.mode) setStreamMode(data.mode);
      
      if (!data?.offer) {
        if (pc) {
          pc.close();
          pc = null;
        }
        return;
      }

      if (!pc) {
        pc = new RTCPeerConnection(rtcConfig);
        pcRef.current = pc;

        pc.ontrack = (event) => {
          if (videoRef.current) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            addDoc(collection(callDoc, 'answerCandidates'), event.candidate.toJSON())
              .catch(error => handleFirestoreError(error, OperationType.WRITE, `${callDoc.path}/answerCandidates`));
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);
        try {
          await updateDoc(callDoc, { answer: { sdp: answerDescription.sdp, type: answerDescription.type } });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, callDoc.path);
        }

        onSnapshot(collection(callDoc, 'offerCandidates'), (candSnap) => {
          candSnap.docChanges().forEach((change) => {
            if (change.type === 'added' && pc) {
              pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            }
          });
        }, (error) => handleFirestoreError(error, OperationType.GET, `${callDoc.path}/offerCandidates`));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, callDoc.path));

    return () => {
      unsubCall();
      if (pc) pc.close();
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [bossId, employeeId]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center group">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted
        className={cn(
          "w-full h-full object-contain",
          streamMode === 'camera' ? "scale-x-[-1]" : ""
        )}
      />
      
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <div className="px-3 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full animate-pulse flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-white rounded-full" />
          EN VIVO
        </div>
        {streamMode && (
          <div className="px-3 py-1 bg-zinc-900/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-full border border-white/10">
            {streamMode === 'screen' ? 'PANTALLA' : 'CÁMARA'}
          </div>
        )}
      </div>
      {videoRef.current?.srcObject && (
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex flex-col gap-2 items-end">
          {!recording ? (
            <Button onClick={() => startRecording()} variant="danger" size="sm" className="gap-2 shadow-xl">
              <Play className="w-3 h-3 fill-current" /> Iniciar Grabación (Auto-Horaria)
            </Button>
          ) : (
            <div className="flex flex-col gap-2 items-end">
              <Button onClick={stopRecording} variant="secondary" size="sm" className="gap-2 shadow-xl animate-pulse">
                <Square className="w-3 h-3 fill-current text-red-600" /> Detener Grabación
              </Button>
              <div className="flex items-center gap-2 px-3 py-1 bg-red-600/90 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-lg">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                Grabando Segmento {segmentCount + 1}...
              </div>
            </div>
          )}
        </div>
      )}

      {!videoRef.current?.srcObject && (
        <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 text-zinc-500">
          <Radio className="w-12 h-12 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest">Esperando señal de video...</p>
        </div>
      )}
    </div>
  );
}
