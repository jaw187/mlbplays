# mlbplays
Retrieve MLB Gameday Plays for a given day

## Install
```
npm install mlbplays
```

## Usage
```
const Mlbplays = require('mlbplays');

const options = {
  path: 'year_2011/month_07/day_23/'
};

const mlbplays = new Mlbplays(options);
mlbplays.get((err, plays) => {

  //... do something
});
```
