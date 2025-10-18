FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* .npmrc* ./

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
