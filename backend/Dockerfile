FROM node:18

RUN apt-get update && apt-get install -y python3 python3-pip python3-venv

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 8080
CMD ["node", "src/index.js"]
