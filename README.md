## How to Run
0. Setup config.ini (following config-example.ini)
1. Setup params.json (following params-example.json)
2. To create the instances and generate scripts to run on the instances, run: 
```bash
sh start.sh
```
3. Run all scripts on the instances by doing:
```bash
for script in test*.sh; do
    nohup sh "$script" > "logs_$script.log" &
done
```
4. When you are done, delete the instances by running:
```bash
sh end.sh
```
