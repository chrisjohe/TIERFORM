const {SAXParser} = require('parse5-sax-parser');

// Inspect HTML as tokens, never as a string to sanitize and reparse.
function htmlTokens(html){
  const tokens=[];
  const parser=new SAXParser();
  for(const type of ['startTag','endTag','text','comment','doctype']){
    parser.on(type,({sourceCodeLocation,...token})=>tokens.push({type,...token}));
  }
  parser.end(html);
  return tokens;
}

function inlineContents(tokens,tagName){
  const contents=[];
  let text=null;
  for(const token of tokens){
    if(token.type==='startTag'&&token.tagName===tagName)text='';
    else if(token.type==='text'&&text!==null)text+=token.text;
    else if(token.type==='endTag'&&token.tagName===tagName&&text!==null){
      contents.push(text.trim());
      text=null;
    }
  }
  return contents;
}

function comparableMarkup(tokens){
  const markup=[];
  let resource=null;
  for(const token of tokens){
    if(resource){
      if(token.type==='endTag'&&token.tagName===resource)resource=null;
      continue;
    }
    if(token.type==='startTag'){
      const attrs=Object.fromEntries(token.attrs.map(attr=>[attr.name,attr.value]));
      if(['script','style'].includes(token.tagName)){resource=token.tagName;continue;}
      if(token.tagName==='meta'&&attrs['http-equiv']?.toLowerCase()==='content-security-policy')continue;
      if(token.tagName==='link'&&attrs.rel==='stylesheet')continue;
    }
    if(token.type==='text'){
      const text=token.text.replace(/\s+/g,' ');
      if(text.trim())markup.push({type:'text',text});
    }else markup.push(token);
  }
  return markup;
}

module.exports={htmlTokens,inlineContents,comparableMarkup};
