FROM node:20-alpine

# Для better-sqlite3 нужны build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p data uploads logs

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "start"]
