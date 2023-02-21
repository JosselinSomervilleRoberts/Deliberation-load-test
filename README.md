## how to run test (for now ignore the docker setting)
0. determine the test room name in server_capacity.js and number of fake users in run_test.py
1. start test: run_test.py (before 'end test')
2. shell: 
for script in dir/*.sh
do
    nohup bash "$script" &
done
3. end test: last block of run_test.py

## TODO
- use CLI to pass parameter for step 0, and check for room existence

## latest test result
- ~35 users per room, in total 45 rooms, for 10min

 on ec2 instance, sometimes need to add *sudo* to make the following commands work.
 ## run
- (docker-compose build)
- docker-compose up

## stop and remove container
docker-compose down

## log
docker logs [CONTAINER ID]

## history
- docker ps
- docker container ls -a

## Structure
```
.
├── puppeteer
│   ├── Dockerfile
│   ...
├── output
│   ├── (optional) screenshots of ongoing meeting rooms
├── docker-compose.yml
└── README.md
```
