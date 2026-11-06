FROM node:22.12 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.12
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist /app/dist
USER node

CMD ["serve", "-s", "dist", "-l", "3000"]
