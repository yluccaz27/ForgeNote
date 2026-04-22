from flask import Flask, Blueprint, render_template, request
from flask_login import LoginManager
from app.fake_bd import fake
app = Flask(__name__)

note_bp = Blueprint('note', __name__)
        
def create_app():
    @note_bp.route("/", methods=["GET", "POST"])
    def login():
            if request.method == 'GET':
                  return render_template('login.html')
            else:
                user = request.form.get("usuario")
                password = request.form.get("password")
                if user in fake:
                    return render_template('home.html', user = user)
                else:
                     return "Senha incorreta!"
    app.register_blueprint(note_bp)
    return app