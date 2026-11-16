# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Una sola familia (12 personas) que hace su amigo secreto de Navidad. Usan el celular (iOS y Android), instalada en la pantalla de inicio. Edades y comodidad con tecnología variadas. Todo en español.

## Product Purpose
Organizar el amigo secreto familiar sin papelitos: cada persona se une eligiendo su nombre de una lista que crea el organizador, escribe su lista de deseos y, tras el sorteo, ve a quién le regala. El organizador nunca ve quién le regala a quién. Éxito: nadie se queda fuera, nadie descubre el emparejamiento, y todos disfrutan el misterio hasta la entrega.

## Positioning
Cifrado de extremo a extremo: el sorteo se hace en el navegador del organizador y los resultados quedan sellados para cada persona. Sin correos ni cuentas externas.

## Operating Context
Un solo grupo por instalación, un solo organizador. Unión por lista de nombres creada por el organizador, PIN de mínimo 4 caracteres. El organizador puede reiniciar el PIN de alguien. Hospedada en Vercel con base de datos Neon.

## Capabilities and Constraints
- Inicio, unirse, lista de deseos, grupo, sorteo, privacidad.
- Nuevo (confirmado por el usuario): chat anónimo tras el sorteo, en dos hilos por persona: con "mi amigo secreto" (a quien yo regalo) y con "quien me regala". Ninguno de los dos revela su identidad en el chat.
- Los mensajes del chat deben ir cifrados de extremo a extremo; ni el organizador ni la base de datos pueden leerlos ni saber quién escribe a quién.
- Avisos de mensaje nuevo: solo un punto rojo dentro de la app. Sin notificaciones push por ahora.
- Se mantiene el flujo existente: sin correos, nombres de una lista, PIN.

## Brand Commitments
Ícono de la app: `app_icon.jpeg` (ya generado en public/icons). El usuario dice que la paleta navideña actual (#A60B08, #5E0001, #1D2E19, #CFCABF, #76584C) no le gusta y la ve aburrida: la dirección visual se redefine.

## Evidence on Hand
Sin testimonios ni métricas. Solo 12 usuarios reales, la familia del organizador.

## Product Principles
1. El secreto manda: nada que filtre quién regala a quién.
2. Sencilla para cualquier edad: pocos pasos, textos claros en español.
3. Se siente como un juego familiar, no como un trámite.
4. Funciona bien en celular y se instala como app.

## Accessibility & Inclusion
Contraste suficiente, tamaños de toque cómodos, respetar prefers-reduced-motion en las animaciones.
