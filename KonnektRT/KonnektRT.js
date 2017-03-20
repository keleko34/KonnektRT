define([],function(){
  
  function CreateKonnektRT()
  {
    var _base = '/app/components',
        _build = 'build',
        _envs = ['qa','stage','prod'];

    /* This is the main routing method */
    function KonnektRT(url)
    {
      if(url.indexOf('/component') === 0)
      {
        var query = KonnektRT.parseQuery(location.search);
        
      }
    }
    
    KonnektRT.parseQuery = function(url)
    { 

    }
    
    function translateEnv(name,env,debug)
    {
      return ('/build/' + env + '/' + name + (debug ? '.js' : '.min.js'));
    }
    
    function attachCMS(url)
    {

    }

        
    function injectPrototype(name,prop)
    {

    }
    
    return KonnektRT;
  }
  return CreateKonnektRT;
});
