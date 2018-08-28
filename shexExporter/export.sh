#!/bin/bash
set -e
echo "Creating SHEX file"
project=$1 
outfile=$2
if [[ "$1" = "-h" ||  "$1" = "--help" || "$#" = "0" || "$outfile" = "" ]] ; then
  echo "usage"
  echo "export.sh <project> <outfile>"
  exit
fi

if [ ! -d "$project" ]; then
  echo "$project does not exists"
  exit
fi

#directory change source from http://stackoverflow.com/questions/59895/can-a-bash-script-tell-what-directory-its-stored-in
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"

echo "exporting"
tempdir=$project/temp
rm -rf "$tempdir"
mkdir "$tempdir"
jena.tdbquery --loc $project --query $DIR/queries/all.txt --results N3 > "$tempdir/temp1.n3"
jena.tdbquery --loc $project --query $DIR/queries/createRoot.txt --results N3 > "$tempdir/temp2.n3"
jena.tdbloader -loc "$tempdir/tempdb/" --graph=http://ssb.wur.nl/shexExporter "$tempdir/temp1.n3"
jena.tdbloader -loc "$tempdir/tempdb/" --graph=http://ssb.wur.nl/shexExporter "$tempdir/temp2.n3"
jena.tdbupdate -loc "$tempdir/tempdb/" --update $DIR/queries/removeSubClassOfThing.txt
#hack not to use to much memory
while [[ $(jena.tdbquery -loc "$tempdir/tempdb/" --query $DIR/queries/removeSubClassOfMeshDone.txt | grep '[01]' |sed 's/.*\([01]\).*/\1/') -eq 1 ]] ; do
  jena.tdbupdate -loc "$tempdir/tempdb/" --update $DIR/queries/removeSubClassOfMesh.txt
  echo "."
done
jena.tdbdump --loc "$tempdir/tempdb/" > "$tempdir/temp.n4"
$DIR/jsonconvert.js convert "$tempdir/temp.n4"  > "$tempdir/out.json"
$DIR/jsonconvert.js compact "$tempdir/out.json" -c $DIR/context.json > "$tempdir/compact.json"
$DIR/jsonconvert.js frame "$tempdir/compact.json" -f $DIR/frame.json > "$tempdir/result.json"

$DIR/shexbuilder.js "$tempdir/result.json" > $outfile
