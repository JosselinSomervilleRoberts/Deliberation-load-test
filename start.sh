echo '=================== Creating instances... ===================';
python create_instances.py;

echo '\n\n=================== Generating scripts... ===================';
find . -name 'test*.sh' -delete
find . -name 'logs_test*.sh.log' -delete
python generate_bash_scripts.py;
