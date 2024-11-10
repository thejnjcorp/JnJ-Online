#!/bin/bash
yourfilenames=`ls ./src/markdown/*.md`

for eachfile in $yourfilenames
do
   test=${eachfile:15:-3}
   echo $test
done > ./public/allFileNames.txt