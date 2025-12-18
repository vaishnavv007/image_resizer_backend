# ---------- BUILD STAGE ----------
FROM node:18-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# ---------- RUNTIME STAGE ----------
FROM node:18-alpine

WORKDIR /usr/src/app

COPY --from=build /usr/src/app /usr/src/app

ENV NODE_ENV=production

USER node

EXPOSE 5000
CMD ["npm", "start"]
