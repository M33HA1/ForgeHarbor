# Stage 1: Build the Go application
FROM golang:1.25-alpine as builder

WORKDIR /app

# Copy module files and download dependencies
COPY go.mod go.sum ./
# Set a reliable Go proxy and then download dependencies
RUN go env -w GOPROXY=https://proxy.golang.org,direct
RUN go mod download

# Copy the rest of the application source code
COPY . .

# Build the Go app, creating a static binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Stage 2: Create the final, minimal image from scratch
FROM scratch

WORKDIR /

# Copy the static binary from the builder stage
COPY --from=builder /app/main .

# Expose the port the app runs on
EXPOSE 8084

# Command to run the executable
CMD ["/main"]