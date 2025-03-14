Software Upgrades
===

To list outdated packages:

```shell
npm outdated
```

To update all outdated packages:

```shell
npm outdated | awk 'NR>1 {print $1"@"$4}' | xargs npm install
```