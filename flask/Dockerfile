FROM python:3.8-buster
WORKDIR /app
ADD . /app
RUN pip install -r requirements.txt
RUN ls
CMD ["gunicorn", "-b :8080", "-k geventwebsocket.gunicorn.workers.GeventWebSocketWorker", "-w 1", "caller:app"]