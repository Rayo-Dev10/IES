# IES
Ayuda comparativa para doble titulación en la IES CINOC

## Visualización local

El contenido de las materias se carga desde archivos JSON mediante `fetch`. Por
seguridad, los navegadores no permiten realizar estas peticiones si simplemente
abres `index.html` como un archivo local. Debes iniciar un servidor HTTP
sencillo y luego navegar a `http://localhost:8000` (o el puerto que uses).

Con Python instalado puedes ejecutar:

```bash
python3 -m http.server
```

Luego abre tu navegador en la dirección que se muestre para ver correctamente
las asignaturas.
