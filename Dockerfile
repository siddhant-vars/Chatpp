FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY Backend/package*.json ./Backend/
COPY Frontend/package*.json ./Frontend/

RUN npm ci --prefix Backend
RUN npm ci --prefix Frontend

COPY Backend ./Backend
COPY Frontend ./Frontend

RUN npm run build --prefix Frontend


FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY Backend/package*.json ./Backend/

RUN npm ci --omit=dev --prefix Backend

COPY Backend ./Backend

COPY --from=builder \
    /app/Frontend/dist \
    ./Frontend/dist

EXPOSE 8000

CMD ["npm", "start"]