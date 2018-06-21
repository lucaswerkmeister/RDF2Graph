#!/usr/bin/env nodejs
'use strict';

var fs = require('fs');
var jsonld = require('./jsonld.js') 

var lib = {};

lib.to_array = function(val)
{
  if(val === undefined)
    return [];
  var res = Array.isArray(val) ? val : [val];
  return res;
};

lib.encodeMultiplicity = function(val)
{
  lib.mulTiplicityComment = null;
  if(val == "http://open-services.net/ns/core#Exactly-one")
    return "";
  else if(val == "http://open-services.net/ns/core#One-or-many")
    return "+";
  else if(val == "http://open-services.net/ns/core#Zero-or-many")
    return "*";
  else if(val == "http://open-services.net/ns/core#Zero-or-one")
    return "?";
  lib.mulTiplicityComment = "No multiplicity defined defaulted to *";
  return "*";
}

lib.encodeType = function(val)
{
  lib.typeComment = null;
  if(val.indexOf("http://www.w3.org/2001/XMLSchema#") == 0)
  {
    return "xsd:" + val.substring("http://www.w3.org/2001/XMLSchema#".length); 
  }
  else if(val == "http://ssb.wur.nl/RDF2Graph/invalid")
  {
    lib.typeComment = "ref to invalid type";
    return ".";
  }
  else if(val == "http://ssb.wur.nl/RDF2Graph/externalref")
  {
    return ".";
  }
  else if(val == "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString")
  {
    return "rdf:langString";
  }
  return "@<" + val + ">";
}

lib.comment = function()
{
  if(lib.mulTiplicityComment != null)
  {
    if(lib.typeComment != null)
      return "#" + lib.mulTiplicityComment + " : " + lib.typeComment;
    return "#" + lib.mulTiplicityComment;
  }
  else if(lib.typeComment != null)
    return "#" + lib.typeComment;
  else
    return "";
}

lib.filterErrors = function(val)
{
  return val.filter(function(elem) { return !("error" in elem); });
}

function objectifyJSONLD(input,callback)
{ 
  jsonld.objectify(input['@graph'], input['@context'], {expandContext:input['@context']},
    function(err, result) {
      callback(err,result);
//    	 console.log(JSON.stringify(result, null, 2));
  });
}

function loadJSON_ld(file,callback) 
{
  fs.readFile(file, 'utf8', function (err, data) {
    if (err) {
      callback(err,null)
      return;
    }

    data = JSON.parse(data);
    jsonld.objectify(data['@graph'], data['@context'], {expandContext:data['@context']}, function(err, result) {
      if(err) 
      {
        callback(err,null)
      }
      else
      {
        callback(null,data['@graph']);
      } 
    });
  });
}

function formatIri(iri) {
  return '<' + iri + '>';
}

function processResult(data)
{
  process.stdout.write('PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\n');
  process.stdout.write('PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n\n');
  for (const clazz of data['class']) {
    if (clazz.subClassOf) {
      process.stdout.write(`${formatIri(clazz['@id'])} & ${lib.to_array(clazz.subClassOf).map(formatIri).join()} {`);
    } else {
      process.stdout.write(`${formatIri(clazz['@id'])} {`);
    }
    const props = lib.to_array(clazz.property);
    let firstProp = true;
    for (const prop of props) {
      let typeLinks = lib.to_array(prop.linkTo);
      typeLinks = lib.filterErrors(typeLinks);
      const typeLinksFormatted = [];
      for (const typeLink of typeLinks) {
        const iri = formatIri(prop.rdfProperty['@id']),
              type = lib.encodeType(typeLink.type['@id']),
              multiplicity = lib.encodeMultiplicity(typeLink.forwardMultiplicity['@id']),
              comment = lib.comment();
        let typeLinkFormatted = `${iri} ${type}${multiplicity}`;
        if (comment) {
          typeLinkFormatted += ` ${comment}`;
        }
        typeLinksFormatted.push(typeLinkFormatted);
      }
      if (typeLinksFormatted.length) {
          if (firstProp) {
              process.stdout.write('\n');
              firstProp = false;
          } else {
              process.stdout.write(',\n');
          }
        if (typeLinksFormatted.length === 1) {
          process.stdout.write(`  ${typeLinksFormatted[0]}`);
        } else {
          process.stdout.write(`  (\n`);
          const lastTypeLinkFormatted = typeLinksFormatted.pop();
          for (const typeLinkFormatted of typeLinksFormatted) {
            process.stdout.write(`    ${typeLinkFormatted} |\n`);
          }
          process.stdout.write(`    ${lastTypeLinkFormatted}\n`);
          process.stdout.write(`  )`);
        }
      }
    }
    process.stdout.write('\n}\n\n');
  }
}

loadJSON_ld("temp/result.json",  function (err, data) {
  if (err) {
    console.log('Error: ' + err);
    return;
  }
  processResult(data[0] || { class: [] });

});

