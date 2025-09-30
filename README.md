# Docker

docker build -t worker .
docker run -d --name worker -p 5000:5000 worker
docker compose up