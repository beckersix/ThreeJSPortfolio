from django.shortcuts import render

def index(request):
    """
    View for rendering the main portfolio page with Three.js visualization
    """
    return render(request, 'portfolio_app/index.html')
