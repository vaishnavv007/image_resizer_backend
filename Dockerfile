# Use an official Node.js runtime as the base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
# Security: use lockfile-based installs for reproducible, auditable builds.
# Security: omit devDependencies in production images to reduce attack surface.
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY . .

# Security: set production mode by default inside the container. This aligns runtime security flags
# (e.g., secure cookies) with production expectations.
ENV NODE_ENV=production

# Security: run as a non-root user to reduce impact of a container escape or RCE.
RUN chown -R node:node /usr/src/app
USER node

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["npm", "start"]
