IMAGE     ?= hr-todo-web
CNAME     ?= hr-todo-web
HOST_PORT ?= 3005
API_URL   ?= http://localhost:3008

.PHONY: build run stop rm restart logs shell clean compose-up compose-down help

help:                ## Показать список команд
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build:               ## Собрать Docker-образ
	docker build -t $(IMAGE) .

run:                 ## Запустить контейнер (loopback-only, TLS на host nginx)
	docker run -d --name $(CNAME) \
		-p 127.0.0.1:$(HOST_PORT):3004 \
		-e API_URL=$(API_URL) \
		-e HTTP_PORT=3004 \
		$(IMAGE)

stop:                ## Остановить контейнер
	docker stop $(CNAME)

rm:                  ## Удалить контейнер
	docker rm $(CNAME)

restart: stop rm run ## Перезапустить контейнер

logs:                ## Следить за логами контейнера
	docker logs -f $(CNAME)

shell:               ## Открыть shell внутри контейнера
	docker exec -it $(CNAME) sh

clean:               ## Удалить образ
	docker rmi $(IMAGE)

compose-up:          ## Поднять через docker compose (читает .env)
	docker compose up -d --build

compose-down:        ## Остановить docker compose
	docker compose down
