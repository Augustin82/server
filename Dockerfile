FROM node:10.15.0

# Create app directory
WORKDIR /usr/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
COPY tsconfig.json ./
COPY autoUpdate.js ./
COPY src/ ./src
COPY knexfile.js ./
COPY migrations/ ./migrations


# NODE_PATH=./build is the runtime version of tsconfig's "baseUrl" setting
# https://stackoverflow.com/questions/42582807/typescript-baseurl-with-node-js
RUN npm install && npm run build

EXPOSE 8080

CMD [ "npm", "run", "start:prod" ]
