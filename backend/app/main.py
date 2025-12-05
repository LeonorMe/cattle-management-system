from fastapi import FastAPI

app = FastAPI(title="Cattle Management System API")

@app.get("/")
def root():
    return {"Hello": "World"}