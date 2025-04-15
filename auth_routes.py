from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_user, logout_user, login_required, UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from db_config import db, User  # Import the database and User model

auth = Blueprint('auth', __name__)

users = {}

class AuthUser(UserMixin):
    def __init__(self, username, password):
        self.username = username
        self.password = generate_password_hash(password)

@auth.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        user = User.query.filter_by(username=username).first()  # Ensure User model is correctly queried

        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for('home'))  # Redirect to main web page
        else:
            flash('Invalid username or password')

    return render_template('login.html')

@auth.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            flash('Username already exists')
        else:
            new_user = User(username=username)  # Ensure User model is correctly instantiated
            new_user.password = generate_password_hash(password)  # Hash the password

            db.session.add(new_user)
            db.session.commit()
            login_user(new_user)  # Automatically log in after signup
            return redirect(url_for('home'))  # Redirect to main web page

    return render_template('signup.html')

@auth.route('/logout')
@login_required
def logout():
    logout_user()
