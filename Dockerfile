# Use an official Node.js runtime (Debian-based)
FROM node:18-slim

# Install build tools needed for native modules like bcrypt
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY . .

# Set production mode
ENV NODE_ENV=production

# Run as non-root user (already exists in node image)
RUN chown -R node:node /usr/src/app
USER node

# Expose the port the app runs on
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
