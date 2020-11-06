from Webapp import socketApp, app

if __name__ == '__main__':
    socketApp.run(app, host='0.0.0.0', port=8080, debug=True)