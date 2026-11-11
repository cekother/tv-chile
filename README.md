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
- `channels.json` es lo que lee la app. Solo incluye canales `https`, porque un navegador no reproduce señales `http` desde una página segura.

Para actualizar (requiere Node 20 o superior):

```
node tools/probar-canales.js     # prueba cada canal y quita de canales.m3u los que no responden
node tools/generar-canales.js    # regenera channels.json y los íconos
```

Para agregar un canal, sumar dos líneas a `canales.m3u` y regenerar:

```
#EXTINF:-1 group-title="Nacionales",Nombre del canal
https://direccion-del-canal/playlist.m3u8
```
