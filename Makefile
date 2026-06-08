.PHONY: serve validate

serve:
	python3 -m http.server 8000

validate:
	python3 validate.py
