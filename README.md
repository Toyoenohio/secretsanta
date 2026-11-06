# 🎅 Secret Santa · Amigo Secreto

Aplicación web moderna y colaborativa para organizar intercambios de **Amigo Secreto** con sorteos matemáticos garantizados, wishlists interactivas y chat anónimo en tiempo real.

![Secret Santa Preview](public/assets/gift-wrapping-with-long-white-silk-ribbon.jpg)

---

## ✨ Características Principales

- **Garantía Matemática de Sorteo (Ciclo Cerrado)**:
  - Algoritmo de permutación cíclica sin puntos fijos (*derangement*).
  - Nadie se saca a sí mismo, nadie queda sin regalar y nadie queda sin recibir.
  - Soporte de **reglas de exclusión** configurables por el organizador (parejas, hermanos, etc.).
- **Wishlist Personal Dinámica**:
  - Entradas de solo texto o texto acompañado de **enlace URL** de tienda.
  - Prioridad de deseo (alta, media, baja) y presupuesto estimado.
  - **Reserva secreta de regalos**: Los demás amigos secretos pueden marcar un regalo como "comprado/reservado" sin que el destinatario lo sepa, evitando regalos repetidos.
- **Perfil Completo y Tallas**:
  - Registro de tallas de camisa, pantalón y calzado.
  - Gustos, intereses, restricciones o alergias para facilitar la elección del regalo.
  - Monogramas personalizados o foto de perfil.
- **Chat Anónimo en Tiempo Real (WebSocket)**:
  - Canal bidireccional anónimo entre el amigo secreto y su asignado.
  - Permite hacer preguntas de tallas, colores o detalles sin revelar la identidad.
- **Multi-Salas y Enlaces de Invitación**:
  - Crea múltiples salas independientes con códigos únicos (ej. `#NAVIDAD-26`).
  - Enlaces directos para compartir en WhatsApp o copiar al portapapeles.
  - Modo organizador para gestionar participantes, exclusiones y lanzar el sorteo.
- **Ambiente Navideño Inmersivo**:
  - Guirnalda de luces festivas animadas puramente en CSS.
  - Nieve en tiempo real con simulación de viento, copos flotantes y acumulación física en la base de la pantalla (con posibilidad de desactivarla o barrerla con el cursor).
- **Progressive Web App (PWA) e Instalable en Móviles**:
  - Compatible con instalación como app nativa en Android (Chrome, Edge, Samsung Internet) e iOS (Safari "Agregar a Inicio").
  - Service Worker con caché inteligente de recursos estáticos y pantalla offline personalizada.
  - Iconos de alta resolución (192x192, 512x512 y maskable) y botón contextual "Instalar".

---

## 🛠️ Stack Tecnológico

- **Framework**: [Astro 5](https://astro.build/) en modo SSR con adaptador `@astrojs/node`
- **Estilos**: [Tailwind CSS v4](https://tailwindcss.com/) + variables CSS personalizadas
- **Base de Datos**: [Neon](https://neon.tech/) Serverless PostgreSQL (`@neondatabase/serverless`)
- **Comunicación en Vivo**: WebSockets (`ws`) integrados en el servidor
- **Tipografía**: Switzer vía CDN de Fontshare

---

## 🚀 Instalación y Puesta en Marcha

### 1. Clonar el repositorio

```bash
git clone https://github.com/Toyoenohio/secretsanta.git
cd secretsanta
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env` basado en `.env.example`:

```env
DATABASE_URL="postgresql://user:password@ep-shiny-band-18559344.us-east-2.aws.neon.tech/secretsanta?sslmode=require"
SESSION_SECRET="super-secret-key-min-32-chars-long"
PORT=4321
```

### 4. Iniciar en modo desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:4321`.

### 5. Compilar para producción

```bash
npm run build
npm start
```

---

## 📄 Licencia

Distribuido bajo la licencia MIT.
