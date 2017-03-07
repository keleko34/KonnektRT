define([],function(){
  var fs = require('fs'),
      query = require('querystring'),
      appPath = process.cwd().replace(/\\/g,"/")+"/app",
      path = require('path'),
      replace = require('replacestream'),
      stream = require('stream'),
      util = require('util');
  
  function CreateKonnektRT()
  {
    /* This is the main routing method */
    function KonnektRT(req,res,next)
    {
      if(req.url.indexOf('/component') === 0)
      {
        /* sort query into single object */
        if(!req.query) req.query = {};
        req.stringQuery = KonnektRT.parseQuery(req.url);
        req.url = req.url.substring(0,req.url.indexOf('?'));

        for (var x = 0, keys=Object.keys(req.stringQuery), len = keys.length; x < len; x++)
        {
            req.query[keys[x]] = req.stringQuery[keys[x]];
        }
        
        /* seperate out important queries */
        var _name = req.url.replace('/component/',''),
            _env = req.query.env || 'prod',
            _debug = req.query.debug,
            _edit = req.query.edit,
            _allowed = (req.sessions ? req.sessions.cms : false),
            
            /* end file url */
            _end = translateEnv(_name,_env,_debug),
            
            /* Base component path */
            _base = appPath+'/components/'+_name,
            
            /* Full Path */
            _path = appPath+'/components/'+_name+'/'+(_env === 'dev' ? _name+_end : _end),
            
            /* File Stream */
            _file,
            
            _finished = 0,
            _total = 0;
        
        /* Check if file even exists */
        fs.stat(_path,function(err,stat){
          if(!err && stat.isFile())
          {
            /* if env is dev we need to combine css and html into main js file */
            if(_env === 'dev')
            {
              _total += 2;
              _file = fs.createReadStream(_path);
              if(_edit && _allowed)
              {
                _total += 1;
                _file.pipe(injectProperty(_name,'k_cms'));
                
                attachCMS(_base,_name,function(content){
                  _finished += 1;
                  
                  
                });
                
                /* wrap and add cms code */
                
              }
              _file.pipe(injectProperty(_name,'K_css'))
              .pipe(injectProperty(_name,'k_html'));
              
            }
            else
            {
              _file = fs.createReadStream(_path);
              
              if(_edit && _allowed)
              {
                _total += 1;
                _file.pipe(injectProperty(_name,'k_cms'));
                
                /* wrap and add cms code */
                attachCMS(_base,_name,function(content){
                  _finished += 1;
                  _file.pipe(attachContentToProto(_file,_name,'k_cms',"(function(){"+content+"\r\nreturn "+_name+";\r\n}())"));
                  if(_finished === _total) _file.pipe(res);
                });
              }
              _file.pipe(injectProperty(_name,'K_css'))
              .pipe(injectProperty(_name,'k_html'));
              
              /* replace props with file content */
              fs.readFile(base+'/'+name+'.html','utf8',function(err,content){
                _finished += 1;
                if(!err)
                {
                  _file.pipe(injectProperty(_name,'k_html'))
                  .pipe(attachContentToProto(_file,_name,'k_html','"'+content+'"'));
                  
                }
                if(_finished === _total) _file.pipe(res);
              });
              
              fs.readFile(base+'/'+name+'.css','utf8',function(err,content){
                _finished += 1;
                if(!err)
                {
                  _file.pipe(injectProperty(_name,'k_css'))
                  .pipe(attachContentToProto(_file,_name,'k_css','"'+content+'"'));
                  
                }
                if(_finished === _total) _file.pipe(res);
              });
            }
          }
          if(err && err.code === 'ENOENT')
          {
            if(_env !== 'dev')
            {
              if(res.notFound)
              {
                res.notFound(undefined,'You have not built the component '+_name+' into environment '+_env);
              }
              else
              {
                error(res,404,'You have not built the component '+_name+' into environment '+_env);
              }
            }
            else
            {
              if(res.notFound)
              {
                res.notFound(undefined,'There is no such component by the name '+_name);
              }
              else
              {
                error(res,404,'There is no such component by the name '+_name);
              }
            }
          }
          else
          {
            if(res.serverError) 
            {
              res.serverError();
            }
            else
            {
              error(res,500,"Server error");
            }
          }
        });
        
      }
      else
      {
        next();
      }
    }
    
    KonnektRT.parseQuery = function(url)
    { 
      return query.parse(url.substring((url.indexOf('?')+1),url.length));
    }
    
    function translateEnv(name,env,debug)
    {
      return (env !== 'dev' ? ('/build/'+env+'/'+name+(debug ? '.js' : '.min.js')) : '.js');
    }
    
    function error(res,code,msg)
    {
      res.statusCode = code;
      res.statusMessage = msg;
      res.write(msg,'utf8');
      res.end();
    }
    
    function attachCMS(base,name,cb)
    {
      var _finished = 0;
      
      fs.readFile(base+'/cms/'+name+".js",'utf8',function(err,contentMain){
        if(!err)
        {
          fs.readFile(base+'/cms/'+name+'.html','utf8',function(err,content){
            if(!err)
            {
              contentMain += '\r\n'+name+'.prototype.k_html = "'+content+'";';
              _finished += 1;
              if(_finished === 2) cb(contetnMain);
            }
            else
            {
              cb("function "+name+"(){};");
            }
          });
          fs.readFile(base+'/cms/'+name+'.css','utf8',function(err,content){
            if(!err)
            {
              contentMain += '\r\n'+name+'.prototype.k_css = "'+content+'";';
              _finished += 1;
              if(_finished === 2) cb(contetnMain);
            }
            else
            {
              cb("function "+name+"(){};");
            }
          });
        }
        else
        {
          cb("function "+name+"(){};");
        }
      })
    }
        
    function streamInjector(options)
    {
      var Transform = stream.Transform;
      
      function inject(options)
      {
        // init Transform
        Transform.call(this, options);
      }
      util.inherits(inject, Transform);
      
      inject.prototype._transform = function (chunk, enc, cb) {
        this.push((typeof options === 'function' ? options(chunk.toString()) : chunk.toString()));
        cb();
      };
      
      return new inject(options);
    }
        
    function injectPrototype(name,prop)
    { 
      var counter = 0,
          startCounter = false;
      
      function count(char,ch)
      {
        return (ch.split(char).length - 1);
      }
      
      return streamInjector(function(chunk){
        if(startCounter)
        {
          counter += count("{",chunk);
          counter -= count("}",chunk);
        }
        if(chunk.indexOf(name) !== -1)
        {
          startCounter = true;
          counter += count("{",chunk);
          counter -= count("}",chunk);
        }
        if(counter === 0 && startCounter) chunk += "\r\n"+name+".prototype."+prop+" = ''";
        return chunk;
      });
    }
        
    function attachContentToProto(file,name,prop,content)
    {
      return replace(name+".prototype."+prop+" = ''",name+".prototype."+prop+" = "+content);
    }
    
    return KonnektRT;
  }
  return CreateKonnektRT;
});
