# TV Chile

Aplicación web instalable para ver canales chilenos de señal abierta en el teléfono, con zapping.

- Deslizar hacia arriba o abajo cambia de canal.
- Deslizar hacia la derecha (o el botón «☰ Canales») abre el menú con los canales numerados y agrupados.
- Deslizar hacia la izquierda vuelve al canal anterior.
- Sin cuentas ni login. Recuerda el último canal visto.

## Instalar en el teléfono

1. Abrir la dirección de la app en Chrome (Android) o Safari (iPhone).
2. Android: menú ⋮ → «Instalar app» o «Agregar a pantalla principal».
   iPhone: botón Compartir → «Agregar a inicio».

## Canales

Los canales salen de listas públicas ([iptv-org](https://github.com/iptv-org/iptv) y [m3u.cl](https://www.m3u.cl)).
La app solo enlaza a las señales que cada canal publica; no aloja ni retransmite video.

- `canales.m3u` es la lista fuente.
- `channels.js` es lo que lee la app. Solo incluye canales `https`, porque un navegador no reproduce señales `http` desde una página segura.

Para actualizar (requiere Node 20 o superior):

```
node tools/probar-canales.js     # prueba cada canal y quita de canales.m3u los que no responden
node tools/generar-canales.js    # regenera channels.js y los íconos
```

Para agregar un canal, sumar dos líneas a `canales.m3u` y regenerar:

```
#EXTINF:-1 group-title="Nacionales",Nombre del canal
https://direccion-del-canal/playlist.m3u8
```

## Control remoto

En un televisor la app se maneja con el control: ▲▼ cambia de canal (también CH+ / CH−), OK abre la lista,
▲▼ + OK dentro de la lista elige un canal, ◀ vuelve al canal anterior, los números van directo a un canal y
Atrás cierra la lista o sale de la app.

## Paquetes para televisor y Android

```
node tools/empaquetar.js            # los tres
node tools/empaquetar.js android    # solo uno: android, webos o tizen
```

Deja en `dist/`:

- `tv-chile.apk`: Android y Android TV / Google TV / Fire TV (Android 5 o superior).
- `cl.cekother.tvchile_1.0.0_all.ipk`: LG webOS. Se instala con `ares-install` en un televisor en modo desarrollador.
- `tizen/`: proyecto para Samsung. Hay que firmarlo con un certificado Samsung desde Tizen Studio antes de instalarlo.

Requisitos, con sus rutas por defecto (se cambian con variables de entorno):

- JDK 17 en `C:/aw/jdk` (`JAVA_HOME`).
- Android SDK con build-tools 34.0.0 y la plataforma android-34 en `C:/aw/android-sdk` (`ANDROID_HOME`).
- `@webos-tools/cli` en `C:/aw/webos-cli` (`WEBOS_CLI`).
- Llave de firma del APK en `C:/aw/keys/tv-chile.jks` (`TVCHILE_KEYSTORE`); se crea sola la primera vez.
  Las actualizaciones del APK deben firmarse con esa misma llave.
