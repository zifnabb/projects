FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

ENV DASHBOARD_PORT=7576
EXPOSE ${DASHBOARD_PORT}

CMD uvicorn app.main:app --host 0.0.0.0 --port ${DASHBOARD_PORT}
