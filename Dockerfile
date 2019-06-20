FROM node:12.4.0

WORKDIR /app

COPY package.json .
COPY yarn.lock .
RUN yarn install

COPY . .

EXPOSE 8000

CMD ["node", "./index.js"]
