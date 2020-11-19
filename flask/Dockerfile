FROM python:3.8-buster
WORKDIR /app
ADD . /app
RUN pip install -r requirements.txt
CMD ["gunicorn", "-b 127.0.0.1:8080", "-k geventwebsocket.gunicorn.workers.GeventWebSocketWorker", "-w 1", "caller:app"]