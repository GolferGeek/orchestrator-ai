# Dockerfile for TypeScript NestJS v2 Application

# Stage 1: Build the application
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./
# COPY yarn.lock ./

# Install dependencies
# If using npm:
RUN npm install
# If using yarn:
# RUN yarn install --frozen-lockfile

# Copy the rest of the application source code
COPY . .

# Build the application (assuming a standard NestJS build script)
RUN npm run build

# Stage 2: Production image
FROM node:18-alpine

WORKDIR /usr/src/app

# Copy only necessary artifacts from the builder stage
# Copy node_modules (optimized for production if possible, e.g., `npm ci --omit=dev` in builder or copy only production dependencies)
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./

# Expose the port the app runs on (default for NestJS is 3000)
EXPOSE 3000

# Command to run the application
CMD ["node", "dist/main.js"] 