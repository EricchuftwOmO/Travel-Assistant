# Builds the React app and serves the static files with nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
# The browser calls the gateway at this address
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL
# Google Maps browser key and map ID (both optional). Without a key, Add place uses the sample list.
# The key ends up in the JavaScript sent to browsers, so restrict it to your site in Google Cloud.
ARG VITE_GOOGLE_MAPS_API_KEY=
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ARG VITE_GOOGLE_MAP_ID=
ENV VITE_GOOGLE_MAP_ID=$VITE_GOOGLE_MAP_ID
# Google OAuth web client ID for the Sign in with Google button (public). Without it the button is hidden.
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
