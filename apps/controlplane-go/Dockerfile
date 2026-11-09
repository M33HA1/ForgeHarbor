FROM golang:1.27.3-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -mod=readonly -trimpath -buildvcs=false -o /out/forgeharbor ./cmd/forgeharbor

FROM build AS test
RUN apk add --no-cache gcc musl-dev
ENV GOCACHE=/tmp/go-cache
USER 65532:65532
CMD ["go", "test", "-mod=readonly", "-race", "-tags=integration", "./..."]

FROM alpine:3.23
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/forgeharbor /usr/local/bin/forgeharbor
USER 65532:65532
ENTRYPOINT ["/usr/local/bin/forgeharbor"]
CMD ["auth"]
