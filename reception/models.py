from django.contrib.auth import get_user_model
from allauth.account.signals import user_logged_in
from allauth.socialaccount.signals import pre_social_login

from common import colorize, color_name_value

# from django.db import models

# Create your models here.

#

User = get_user_model()

def user_logged_in_receiver(request, user, **kwargs):
    show = colorize('user_logged_in_receiver()', 'green')
    show += '   ' + color_name_value('user.email', user.email)
    print(show)

user_logged_in.connect(user_logged_in_receiver, sender=User)

def pre_social_login_receiver(request, sociallogin, **kwargs):
    show = colorize('pre_social_login_receiver()', 'green')
    show += '   ' + color_name_value('user.email', sociallogin.email)
    print(show)
    print(request)
    print(sociallogin)

pre_social_login.connect(pre_social_login_receiver, sender=User)

# @receiver(user_signed_up)
# def populate_profile(sociallogin, user, **kwargs):

#     if sociallogin.account.provider == 'facebook':
#         user_data = user.socialaccount_set.filter(provider='facebook')[0].extra_data
#         picture_url = "http://graph.facebook.com/" + sociallogin.account.uid + "/picture?type=large"
#         email = user_data['email']
#         first_name = user_data['first_name']

#     if sociallogin.account.provider == 'linkedin':
#         user_data = user.socialaccount_set.filter(provider='linkedin')[0].extra_data
#         picture_url = user_data['picture-urls']['picture-url']
#         email = user_data['email-address']
#         first_name = user_data['first-name']

#     if sociallogin.account.provider == 'twitter':
#         user_data = user.socialaccount_set.filter(provider='twitter')[0].extra_data
#         picture_url = user_data['profile_image_url']
#         picture_url = picture_url.rsplit("_", 1)[0] + "." + picture_url.rsplit(".", 1)[1]
#         email = user_data['email']
#         first_name = user_data['name'].split()[0]

#     user.profile.avatar_url = picture_url
#     user.profile.email_address = email
#     user.profile.first_name = first_name
#     user.profile.save()