FROM node:lts-alpine

# Create app directory and set permissions
RUN mkdir -p /home/node/app && chown -R node:node /home/node/app

WORKDIR /home/node/app

# Copy package files and set permissions
COPY --chown=node:node package*.json ./

USER node

RUN npm install

# Copy the rest of the application code and set permissions
COPY --chown=node:node . .

# Copy the db directory and set permissions
COPY --chown=node:node db /home/node/db

# Build the TypeScript code
RUN npm run build

EXPOSE 8080

CMD [ "npm", "start" ]